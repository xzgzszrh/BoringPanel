package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"go.signoz.io/signoz/pkg/query-service/app/debugmode"
	"go.signoz.io/signoz/pkg/query-service/auth"
	"go.signoz.io/signoz/pkg/query-service/model"
	"go.signoz.io/signoz/pkg/query-service/rules"
)

const debugAlertName = "[调试] Scry 请求流量"

func (aH *APIHandler) getDebugScenarios(w http.ResponseWriter, _ *http.Request) {
	aH.Respond(w, debugmode.ScenarioCatalog())
}

func (aH *APIHandler) getDebugScenarioTruth(w http.ResponseWriter, r *http.Request) {
	scenarioID := mux.Vars(r)["scenarioId"]
	truth, ok := debugmode.ScenarioTruth(scenarioID)
	if !ok {
		RespondError(w, &model.ApiError{Typ: model.ErrorNotFound, Err: fmt.Errorf("debug scenario not found: %s", scenarioID)}, nil)
		return
	}
	aH.Respond(w, truth)
}

func (aH *APIHandler) getDebugMode(w http.ResponseWriter, r *http.Request) {
	orgID, apiErr := debugModeOrgID(r)
	if apiErr != nil {
		RespondError(w, apiErr, nil)
		return
	}
	if aH.debugModeManager == nil {
		RespondError(w, &model.ApiError{Typ: model.ErrorNotImplemented, Err: errors.New("debug mode is unavailable")}, nil)
		return
	}
	status, err := aH.debugModeManager.GetStatus(orgID)
	if err != nil {
		RespondError(w, &model.ApiError{Typ: model.ErrorInternal, Err: err}, nil)
		return
	}
	aH.Respond(w, status)
}

func (aH *APIHandler) updateDebugMode(w http.ResponseWriter, r *http.Request) {
	orgID, apiErr := debugModeOrgID(r)
	if apiErr != nil {
		RespondError(w, apiErr, nil)
		return
	}
	var config debugmode.Config
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64*1024))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&config); err != nil {
		RespondError(w, &model.ApiError{Typ: model.ErrorBadData, Err: err}, nil)
		return
	}
	status, err := aH.debugModeManager.Update(orgID, config)
	if err != nil {
		RespondError(w, &model.ApiError{Typ: model.ErrorBadData, Err: err}, nil)
		return
	}
	if config.Enabled && config.Signals.Metrics {
		if err := aH.ensureDebugAlertRule(r); err != nil {
			RespondError(w, &model.ApiError{Typ: model.ErrorInternal, Err: err}, nil)
			return
		}
	}
	aH.Respond(w, status)
}

func (aH *APIHandler) generateDebugData(w http.ResponseWriter, r *http.Request) {
	orgID, apiErr := debugModeOrgID(r)
	if apiErr != nil {
		RespondError(w, apiErr, nil)
		return
	}
	status, err := aH.debugModeManager.GenerateNow(r.Context(), orgID)
	if err != nil {
		RespondError(w, &model.ApiError{Typ: model.ErrorExec, Err: err}, nil)
		return
	}
	aH.Respond(w, status)
}

func (aH *APIHandler) cleanupDebugData(w http.ResponseWriter, r *http.Request) {
	orgID, apiErr := debugModeOrgID(r)
	if apiErr != nil {
		RespondError(w, apiErr, nil)
		return
	}
	if err := aH.deleteDebugAlertRules(r); err != nil {
		RespondError(w, &model.ApiError{Typ: model.ErrorInternal, Err: err}, nil)
		return
	}
	status, err := aH.debugModeManager.Cleanup(orgID)
	if err != nil {
		RespondError(w, &model.ApiError{Typ: model.ErrorExec, Err: err}, nil)
		return
	}
	aH.Respond(w, status)
}

func debugModeOrgID(r *http.Request) (string, *model.ApiError) {
	user, err := auth.GetUserFromRequest(r)
	if err != nil {
		return "", &model.ApiError{Typ: model.ErrorUnauthorized, Err: err}
	}
	if user.OrgId == "" {
		return "", &model.ApiError{Typ: model.ErrorUnauthorized, Err: errors.New("orgId is missing")}
	}
	return user.OrgId, nil
}

func (aH *APIHandler) ensureDebugAlertRule(r *http.Request) error {
	storedRules, err := aH.ruleManager.RuleDB().GetStoredRules(r.Context())
	if err != nil {
		return err
	}
	for _, stored := range storedRules {
		var rule rules.PostableRule
		if json.Unmarshal([]byte(stored.Data), &rule) == nil && rule.AlertName == debugAlertName {
			return nil
		}
	}

	rule := rules.PostableRule{
		AlertName:   debugAlertName,
		AlertType:   rules.AlertTypeMetric,
		Description: "调试模式自动创建的请求流量告警规则",
		EvalWindow:  rules.Duration(5 * 60 * 1e9),
		Frequency:   rules.Duration(60 * 1e9),
		Expr:        "scry_debug_requests_per_second > 0",
		Labels: map[string]string{
			"severity":   "info",
			"scry_debug": "true",
		},
		Annotations: map[string]string{
			"summary": "Scry 调试数据正在生成",
		},
		Disabled: false,
	}
	body, err := json.Marshal(rule)
	if err != nil {
		return err
	}
	_, err = aH.ruleManager.CreateRule(r.Context(), string(body))
	return err
}

func (aH *APIHandler) deleteDebugAlertRules(r *http.Request) error {
	storedRules, err := aH.ruleManager.RuleDB().GetStoredRules(r.Context())
	if err != nil {
		return err
	}
	for _, stored := range storedRules {
		var rule rules.PostableRule
		if json.Unmarshal([]byte(stored.Data), &rule) != nil {
			continue
		}
		if rule.AlertName != debugAlertName && rule.Labels["scry_debug"] != "true" {
			continue
		}
		if err := aH.ruleManager.DeleteRule(r.Context(), strconv.Itoa(stored.Id)); err != nil {
			return err
		}
	}
	return nil
}

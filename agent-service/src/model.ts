import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

import type { ModelSettings } from './types.js';

const OFFICIAL_BASE_URLS = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
} as const;

export function resolveBaseUrl(settings: ModelSettings): string {
  if (settings.endpointMode === 'official') return OFFICIAL_BASE_URLS[settings.provider];
  const baseUrl = settings.baseUrl.trim().replace(/\/+$/, '');
  if (!baseUrl) throw new Error('自定义端点模式必须填写 Base URL');
  return settings.provider === 'openai'
    ? baseUrl.replace(/\/responses$/, '')
    : baseUrl.replace(/\/messages$/, '');
}

export function resolvedRequestEndpoint(settings: ModelSettings): string {
  const baseUrl = resolveBaseUrl(settings);
  return `${baseUrl}/${settings.provider === 'openai' ? 'responses' : 'messages'}`;
}

export function createLanguageModel(settings: ModelSettings): LanguageModel {
  if (!settings.apiKey) throw new Error('请先在“设置 > AI 设置”中保存模型 API Key');

  const baseURL = resolveBaseUrl(settings);

  if (settings.provider === 'anthropic') {
    const provider = createAnthropic({
      apiKey: settings.apiKey,
      baseURL,
    });
    return provider(settings.model);
  }

  const provider = createOpenAI({
    apiKey: settings.apiKey,
    baseURL,
    name: settings.endpointMode === 'custom' ? 'openai-compatible' : 'openai',
  });
  return provider.responses(settings.model);
}

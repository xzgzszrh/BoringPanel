package version

import (
	"fmt"
	"runtime"
)

// These fields are set during an official build
// Global vars set from command-line arguments
var (
	buildVersion = "--"
	buildHash    = "--"
	buildTime    = "--"
	gitBranch    = "--"
)

// BuildDetails returns the Scry Query Service build and runtime details.
func BuildDetails() string {
	return fmt.Sprintf(`
Scry Query Service
Version          : %v
Commit SHA-1     : %v
Commit timestamp : %v
Branch           : %v
Go version       : %v
`,
		buildVersion, buildHash, buildTime, gitBranch,
		runtime.Version())
}

// PrintVersion prints version and other helpful information.
func PrintVersion() {
	fmt.Println(BuildDetails())
}

func GetVersion() string {
	return buildVersion
}

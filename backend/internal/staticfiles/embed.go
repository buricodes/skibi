// Package staticfiles embeds the built frontend into the server binary, so
// production is a single deployable artifact — no separate static host, no
// CORS between two services. See BUILD_PLAN.md §6.
//
// dist/ starts out holding only a placeholder (see dist/index.html) so
// `go build`/`go run` keep working before the frontend has ever been
// built — go:embed requires at least one matching file to compile. The
// real build command overwrites dist/ with frontend/dist's actual output
// before compiling the production binary.
package staticfiles

import "embed"

//go:embed dist
var DistFS embed.FS

package redisratelim

import _ "embed"

// The script lives in Engine.lua so there is exactly one copy — and so the
// editor treats it as Lua instead of an opaque Go string.
//
//go:embed Engine.lua
var tokenBucketScript string

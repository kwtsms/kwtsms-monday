// monday-code secrets are NOT exposed via process.env. They must be read via
// the SDK's SecretsManager. Environment variables work via EnvironmentVariablesManager
// unless you pass { updateProcessEnv: true } at construction time.
//
// Outside monday-code (local dev, tests) the SDK is not available or not
// initialized, so we fall back to process.env so local `.env.test` keeps working.

type SecretsLike = { get(key: string): string | undefined };
type EnvsLike = { get(key: string): string | undefined };

let _secrets: SecretsLike | null | undefined;
let _envs: EnvsLike | null | undefined;

function secrets(): SecretsLike | null {
  if (_secrets === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { SecretsManager } = require('@mondaycom/apps-sdk');
      _secrets = new SecretsManager() as SecretsLike;
    } catch {
      _secrets = null;
    }
  }
  return _secrets ?? null;
}

function envs(): EnvsLike | null {
  if (_envs === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { EnvironmentVariablesManager } = require('@mondaycom/apps-sdk');
      _envs = new EnvironmentVariablesManager() as EnvsLike;
    } catch {
      _envs = null;
    }
  }
  return _envs ?? null;
}

export function getSecret(key: string): string {
  try {
    const v = secrets()?.get(key);
    if (v) return v;
  } catch {
    /* fall through */
  }
  return process.env[key] ?? '';
}

export function getEnv(key: string): string {
  try {
    const v = envs()?.get(key);
    if (v) return v;
  } catch {
    /* fall through */
  }
  return process.env[key] ?? '';
}

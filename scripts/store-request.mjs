const requestTimeoutMs = 120_000;

export async function storeFetch(label, url, options = {}) {
  const method = options.method ?? 'GET';
  let response;

  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(requestTimeoutMs) });
  } catch (error) {
    const reason = error.cause?.code ?? error.message;

    throw new Error(`${label} request ${method} ${url} could not complete: ${reason}`, { cause: error });
  }

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`${label} request ${method} ${url} failed (${response.status}): ${body}`);
  }

  return { response, body };
}

export function parseJsonBody(label, url, body) {
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${label} request ${url} returned a body that is not JSON: ${body.slice(0, 200)}`);
  }
}

export function missingVariables(names, environment = process.env) {
  return names.filter((name) => !environment[name]);
}

export function reportFatalError(error) {
  console.error(`::error::${error.message}`);

  if (error.cause) {
    console.error(error.cause);
  }

  process.exit(1);
}

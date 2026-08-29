/** Copy-paste for Home Assistant configuration.yaml — required so the
 *  browser on bumblehub.dev can call the LAN HA API. Restart HA after. */
export const HOME_ASSISTANT_CORS_YAML = `http:
  cors_allowed_origins:
    - https://bumblehub.dev
    - http://localhost:3000
    - http://localhost:3001`;

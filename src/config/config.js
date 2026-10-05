import convict from 'convict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import convictFormatWithValidator from 'convict-format-with-validator'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const fourHoursMs = 14400000
const oneWeekMs = 604800000

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'
const isDevelopment = process.env.NODE_ENV === 'development'

convict.addFormats(convictFormatWithValidator)

export const config = convict({
  serviceVersion: {
    doc: 'The service version, this variable is injected into your docker container in CDP environments',
    format: String,
    nullable: true,
    default: null,
    env: 'SERVICE_VERSION'
  },
  host: {
    doc: 'The IP address to bind',
    format: 'ipaddress',
    default: '0.0.0.0',
    env: 'HOST'
  },
  port: {
    doc: 'The port to bind.',
    format: 'port',
    default: 3000,
    env: 'PORT'
  },
  staticCacheTimeout: {
    doc: 'Static cache timeout in milliseconds',
    format: Number,
    default: oneWeekMs,
    env: 'STATIC_CACHE_TIMEOUT'
  },
  serviceName: {
    doc: 'Applications Service Name',
    format: String,
    default: 'waste-batteries-admin-panel-fe'
  },
  root: {
    doc: 'Project root',
    format: String,
    default: path.resolve(dirname, '../..')
  },
  assetPath: {
    doc: 'Asset path',
    format: String,
    default: '/public',
    env: 'ASSET_PATH'
  },
  isProduction: {
    doc: 'If this application running in the production environment',
    format: Boolean,
    default: isProduction
  },
  isDevelopment: {
    doc: 'If this application running in the development environment',
    format: Boolean,
    default: isDevelopment
  },
  isTest: {
    doc: 'If this application running in the test environment',
    format: Boolean,
    default: isTest
  },
  log: {
    enabled: {
      doc: 'Is logging enabled',
      format: Boolean,
      default: process.env.NODE_ENV !== 'test',
      env: 'LOG_ENABLED'
    },
    level: {
      doc: 'Logging level',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
      env: 'LOG_LEVEL'
    },
    format: {
      doc: 'Format to output logs in.',
      format: ['ecs', 'pino-pretty'],
      default: isProduction ? 'ecs' : 'pino-pretty',
      env: 'LOG_FORMAT'
    },
    redact: {
      doc: 'Log paths to redact',
      format: Array,
      // Redacted in every environment — auth headers and cookies now carry
      // session material, which must never reach logs
      default: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers'
      ],
      env: 'LOG_REDACT'
    }
  },
  httpProxy: {
    doc: 'HTTP Proxy',
    format: String,
    nullable: true,
    default: null,
    env: 'HTTP_PROXY'
  },
  isSecureContextEnabled: {
    doc: 'Enable Secure Context',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_SECURE_CONTEXT'
  },
  session: {
    cache: {
      engine: {
        doc: 'backend cache is written to',
        format: ['redis', 'memory'],
        default: isProduction ? 'redis' : 'memory',
        env: 'SESSION_CACHE_ENGINE'
      },
      name: {
        doc: 'server side session cache name',
        format: String,
        default: 'session',
        env: 'SESSION_CACHE_NAME'
      },
      ttl: {
        doc: 'server side session cache ttl',
        format: Number,
        default: fourHoursMs,
        env: 'SESSION_CACHE_TTL'
      }
    },
    cookie: {
      ttl: {
        doc: 'Session cookie ttl',
        format: Number,
        default: fourHoursMs,
        env: 'SESSION_COOKIE_TTL'
      },
      password: {
        doc: 'session cookie password',
        format: String,
        default: 'the-password-must-be-at-least-32-characters-long',
        env: 'SESSION_COOKIE_PASSWORD',
        sensitive: true
      },
      secure: {
        doc: 'set secure flag on cookie',
        format: Boolean,
        default: isProduction,
        env: 'SESSION_COOKIE_SECURE'
      }
    },
    absoluteTtl: {
      doc: 'Hard ceiling on a signed-in session, measured from sign-in; cookie keep-alive cannot extend a session past it',
      format: Number,
      default: fourHoursMs,
      env: 'SESSION_ABSOLUTE_TTL'
    }
  },
  auth: {
    requiredRole: {
      doc: 'Entra app role a signed-in user needs to use any route that does not opt out. Must match the role value on the App Registration',
      format: String,
      default: 'Admin',
      env: 'ENTRA_REQUIRED_ROLE'
    },
    oidc: {
      clientId: {
        doc: 'Entra ID App Registration client (application) id',
        format: String,
        default: 'local-client-id',
        env: 'ENTRA_CLIENT_ID'
      },
      discoveryUri: {
        doc: 'Entra ID .well-known/openid-configuration URL, e.g. https://login.microsoftonline.com/<tenant-id>/v2.0/.well-known/openid-configuration. The default is the local Entra stub in compose.yml',
        format: 'url',
        default: 'http://localhost:3210/entra/.well-known/openid-configuration',
        env: 'ENTRA_DISCOVERY_URI'
      },
      externalBaseUrl: {
        doc: 'Public base URL of this service, used to build the callback URL, no trailing slash',
        format: 'url',
        default: 'http://localhost:3000',
        env: 'APP_BASE_URL'
      },
      scope: {
        doc: 'Space-separated scopes requested at sign-in',
        format: String,
        default: 'openid profile email offline_access user.read',
        env: 'ENTRA_SCOPES'
      },
      responseMode: {
        doc: 'How Entra returns the sign-in response: form_post (recommended, needs HTTPS) or query. Null omits the parameter, which defaults to query',
        format: ['form_post', 'query'],
        nullable: true,
        default: isProduction ? 'form_post' : null,
        env: 'ENTRA_RESPONSE_MODE'
      }
    },
    federatedCredentials: {
      audience: {
        doc: 'Audience of the AWS STS web identity token; must match the federated credential on the App Registration',
        format: String,
        default: 'api://AzureADTokenExchange',
        env: 'ENTRA_FEDERATED_AUDIENCE'
      },
      enableMocking: {
        doc: 'Send a fake client assertion, which only the local Entra stub accepts, instead of an AWS STS web identity token. Local development and CI only; the app refuses to start with it on in CDP',
        format: Boolean,
        default: !isProduction,
        env: 'ENTRA_FEDERATED_MOCKING'
      }
    }
  },
  redis: {
    host: {
      doc: 'Redis cache host',
      format: String,
      default: '127.0.0.1',
      env: 'REDIS_HOST'
    },
    username: {
      doc: 'Redis cache username',
      format: String,
      default: '',
      env: 'REDIS_USERNAME'
    },
    password: {
      doc: 'Redis cache password',
      format: '*',
      default: '',
      sensitive: true,
      env: 'REDIS_PASSWORD'
    },
    keyPrefix: {
      doc: 'Redis cache key prefix name used to isolate the cached results across multiple clients',
      format: String,
      default: 'waste-batteries-admin-panel-fe:',
      env: 'REDIS_KEY_PREFIX'
    },
    useSingleInstanceCache: {
      doc: 'Connect to a single instance of redis instead of a cluster.',
      format: Boolean,
      default: !isProduction,
      env: 'USE_SINGLE_INSTANCE_CACHE'
    },
    useTLS: {
      doc: 'Connect to redis using TLS',
      format: Boolean,
      default: isProduction,
      env: 'REDIS_TLS'
    }
  },
  nunjucks: {
    watch: {
      doc: 'Reload templates when they are changed.',
      format: Boolean,
      default: isDevelopment
    },
    noCache: {
      doc: 'Use a cache and recompile templates each time',
      format: Boolean,
      default: isDevelopment
    }
  },
  tracing: {
    header: {
      doc: 'Which header to track',
      format: String,
      default: 'x-cdp-request-id',
      env: 'TRACING_HEADER'
    }
  }
})

config.validate({ allowed: 'strict' })

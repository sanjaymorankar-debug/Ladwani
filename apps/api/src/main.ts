import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { trustProxySetting } from './common/trust-proxy'

async function bootstrap() {
  // Fail fast rather than silently sign every session token with a secret checked into source
  // control — the dev fallback below (auth.module.ts, jwt.strategy.ts) exists only for local dev.
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in production — refusing to start with the dev default secret.')
  }

  // rawBody: true keeps req.rawBody available on every request (needed for webhook signature
  // verification, which must run over the exact bytes sent — docs/19 §3) without disabling the
  // global JSON parser for every other route.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true })
  // Per-visitor rate limits behind a proxy -- see common/trust-proxy.ts.
  const trustProxy = trustProxySetting(process.env.TRUST_PROXY)
  if (trustProxy !== undefined) app.set('trust proxy', trustProxy)
  app.use(helmet())
  app.use(cookieParser())
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true })
  app.setGlobalPrefix('api/v1')
  // API_PORT: when the web app and the API share one process (one Hostinger site,
  // scripts/hostinger-start.js), the API listens on its own internal port and the
  // web app takes the site's PORT.
  const port = process.env.API_PORT ?? process.env.PORT ?? 4000
  if (process.env.API_PORT) await app.listen(port, '127.0.0.1')
  else await app.listen(port)
}
bootstrap()

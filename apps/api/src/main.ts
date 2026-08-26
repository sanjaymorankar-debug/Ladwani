import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { AppModule } from './app.module'

async function bootstrap() {
  // Fail fast rather than silently sign every session token with a secret checked into source
  // control — the dev fallback below (auth.module.ts, jwt.strategy.ts) exists only for local dev.
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in production — refusing to start with the dev default secret.')
  }

  // rawBody: true keeps req.rawBody available on every request (needed for webhook signature
  // verification, which must run over the exact bytes sent — docs/19 §3) without disabling the
  // global JSON parser for every other route.
  const app = await NestFactory.create(AppModule, { rawBody: true })
  app.use(helmet())
  app.use(cookieParser())
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true })
  app.setGlobalPrefix('api/v1')
  const port = process.env.PORT ?? 4000
  await app.listen(port)
}
bootstrap()

import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module'

async function bootstrap() {
  // rawBody: true keeps req.rawBody available on every request (needed for webhook signature
  // verification, which must run over the exact bytes sent — docs/19 §3) without disabling the
  // global JSON parser for every other route.
  const app = await NestFactory.create(AppModule, { rawBody: true })
  app.use(cookieParser())
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true })
  app.setGlobalPrefix('api/v1')
  const port = process.env.PORT ?? 4000
  await app.listen(port)
}
bootstrap()

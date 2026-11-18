import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173',
  });

  app.useStaticAssets(join(process.cwd(), 'uploads', 'profiles'), { prefix: '/uploads/profiles' });
  app.useStaticAssets(join(process.cwd(), 'uploads', 'projects'), { prefix: '/uploads/projects' });

  

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port, () => console.log(`service started on port ${port}`));
}

await bootstrap();
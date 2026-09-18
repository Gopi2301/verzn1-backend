import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Running Athlete, Coach & Club Platform API')
    .setDescription(
      'API powering structured training, coaching relationships, running clubs, and athlete performance metrics.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Users', 'User account & base profile coordination')
    .addTag('Athletes', 'Athlete profiles and baseline physiological parameters')
    .addTag('Coaches', 'Coach profiles, specializations, and roster management')
    .addTag('Clubs', 'Running club management, roles, and membership')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application running on: http://localhost:${port}/api/v1`);
  console.log(`Swagger Documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap();

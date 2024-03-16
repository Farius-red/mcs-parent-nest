import { Module } from '@nestjs/common';

import { AppService } from './app.service';
import { CrudController } from './core/utils/crudController';

@Module({
  imports: [],
  providers: [AppService],
  exports:[CrudController]
})
export class AppModule {}

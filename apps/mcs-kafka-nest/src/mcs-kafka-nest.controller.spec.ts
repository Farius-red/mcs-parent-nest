import { Test, TestingModule } from '@nestjs/testing';
import { McsKafkaNestController } from './mcs-kafka-nest.controller';
import { McsKafkaNestService } from './mcs-kafka-nest.service';

describe('McsKafkaNestController', () => {
  let mcsKafkaNestController: McsKafkaNestController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [McsKafkaNestController],
      providers: [McsKafkaNestService],
    }).compile();

    mcsKafkaNestController = app.get<McsKafkaNestController>(
      McsKafkaNestController,
    );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(mcsKafkaNestController.getHello()).toBe('Hello World!');
    });
  });
});

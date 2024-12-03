import { Test, TestingModule } from '@nestjs/testing';
import { KafkaListenerService } from './kafka-listener.service';

describe('KafkaListenerService', () => {
  let service: KafkaListenerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KafkaListenerService],
    }).compile();

    service = module.get<KafkaListenerService>(KafkaListenerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

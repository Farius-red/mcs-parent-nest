import { Test, TestingModule } from '@nestjs/testing';
import { TaigaService } from './taiga.service';

describe('TaigaService', () => {
  let service: TaigaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaigaService],
    }).compile();

    service = module.get<TaigaService>(TaigaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

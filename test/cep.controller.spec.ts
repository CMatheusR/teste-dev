import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CepController } from '../src/cep/cep.controller';
import { CepService } from '../src/cep/cep.service';
import { CepResponseDto } from '../src/cep/dto/cep-response.dto';
import { CepNotFoundException } from '../src/common/exceptions/cep-not-found.exception';
import { AllProvidersFailedException } from '../src/common/exceptions/all-providers-failed.exception';

const mockResult: CepResponseDto = {
  cep: '01310-100',
  logradouro: 'Avenida Paulista',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  estado: 'SP',
  provider: 'ViaCEP',
};

describe('CepController', () => {
  let controller: CepController;
  let cepService: jest.Mocked<Pick<CepService, 'fetchCep'>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CepController],
      providers: [{ provide: CepService, useValue: { fetchCep: jest.fn() } }],
    }).compile();

    controller = module.get<CepController>(CepController);
    cepService = module.get(CepService);
  });

  it('should return CepResponseDto for valid 8-digit cep', async () => {
    cepService.fetchCep.mockResolvedValue(mockResult);

    const result = await controller.getCep('01310100');

    expect(result).toEqual(mockResult);
    expect(cepService.fetchCep).toHaveBeenCalledWith('01310100');
  });

  it('should throw BadRequestException for cep with letters', async () => {
    await expect(controller.getCep('0131010A')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException for cep shorter than 8 digits', async () => {
    await expect(controller.getCep('0131010')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException for cep longer than 8 digits', async () => {
    await expect(controller.getCep('013101000')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should propagate CepNotFoundException', async () => {
    cepService.fetchCep.mockRejectedValue(new CepNotFoundException('99999999'));
    await expect(controller.getCep('99999999')).rejects.toThrow(
      CepNotFoundException,
    );
  });

  it('should propagate AllProvidersFailedException', async () => {
    cepService.fetchCep.mockRejectedValue(
      new AllProvidersFailedException('01310100'),
    );
    await expect(controller.getCep('01310100')).rejects.toThrow(
      AllProvidersFailedException,
    );
  });
});

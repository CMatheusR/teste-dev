import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosHeaders } from 'axios';
import { of, throwError } from 'rxjs';
import { ViaCepProvider } from '../src/cep/providers/viacep.provider';
import { CepNotFoundException } from '../src/common/exceptions/cep-not-found.exception';

const axiosResponse = (data: unknown) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: new AxiosHeaders() },
});

describe('ViaCepProvider', () => {
  let provider: ViaCepProvider;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ViaCepProvider,
        { provide: HttpService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    provider = module.get<ViaCepProvider>(ViaCepProvider);
    httpService = module.get(HttpService);
  });

  it('should map ViaCEP response to CepResponseDto', async () => {
    httpService.get.mockReturnValue(
      of(
        axiosResponse({
          cep: '01310-100',
          logradouro: 'Avenida Paulista',
          bairro: 'Bela Vista',
          localidade: 'São Paulo',
          uf: 'SP',
        }),
      ),
    );

    const result = await provider.fetchCep('01310100');

    expect(result).toEqual({
      cep: '01310100',
      logradouro: 'Avenida Paulista',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      estado: 'SP',
      provider: 'ViaCEP',
    });
  });

  it('should call correct ViaCEP URL', async () => {
    httpService.get.mockReturnValue(
      of(
        axiosResponse({
          cep: '01310-100',
          logradouro: 'Av. Paulista',
          bairro: 'Bela Vista',
          localidade: 'São Paulo',
          uf: 'SP',
        }),
      ),
    );

    await provider.fetchCep('01310100');

    expect(httpService.get).toHaveBeenCalledWith(
      'https://viacep.com.br/ws/01310100/json/',
    );
  });

  it('should throw CepNotFoundException when ViaCEP returns { erro: true }', async () => {
    httpService.get.mockReturnValue(of(axiosResponse({ erro: true })));

    await expect(provider.fetchCep('99999999')).rejects.toThrow(
      CepNotFoundException,
    );
  });

  it('should rethrow on network/timeout error', async () => {
    const error = new AxiosError('timeout', 'ECONNABORTED');
    httpService.get.mockReturnValue(throwError(() => error));

    await expect(provider.fetchCep('01310100')).rejects.toThrow(AxiosError);
  });
});

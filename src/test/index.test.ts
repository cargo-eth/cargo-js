import Cargo from '../main';

const fetchMock = fetch as any;

describe('Cargo', () => {
  describe('init', () => {
    beforeEach(async () => {
      fetchMock.resetMocks();
    });
    test('should spread default options', async () => {
      fetchMock.mockResponse(JSON.stringify({ access_token: '12345' }));
      const cargo = new Cargo();
      expect(cargo.options).toEqual({
        network: 'development',
      });
    });
    test('should only allow valid options', async () => {
      fetchMock.mockResponse(JSON.stringify({ access_token: '12345' }));
      try {
        // @ts-ignore
        new Cargo({ brain: 'zombies' });
      } catch (e) {
        expect(e.message).toBe(`brain is not a valid Cargo option.`);
        return true;
      }
      throw new Error('Should have thrown.');
    });
    test('should only allow object as options', async () => {
      fetchMock.mockResponse(JSON.stringify({ access_token: '12345' }));
      try {
        // @ts-ignore
        new Cargo(() => 'hi');
      } catch (e) {
        expect(e.message).toBe('Options are invalid.');
        return true;
      }
      throw new Error('Should only allow object as options');
    });
    test('should get request url based on network', async () => {
      const cargoProduction = new Cargo({ network: 'production' });
      const cargoLocal = new Cargo({ network: 'local' });
      const cargoDev = new Cargo({ network: 'development' });

      expect(cargoProduction.requestUrl).toBe('https://api.cargo.build');
      expect(cargoLocal.requestUrl).toBe('http://localhost:3333');
      expect(cargoDev.requestUrl).toBe('https://dev-api.cargo.engineering');
    });
    test.todo('should get all contracts from cargo backend');
    test.todo('should create a new API class');
    test.todo('should emit no enabled event');
    test.todo('should emit provider required event');
  });
});

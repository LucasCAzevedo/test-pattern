import { CheckoutService } from '../src/services/CheckoutService.js';
import { Item } from '../src/domain/Item.js';
import { Pedido } from '../src/domain/Pedido.js';
import { UserMother } from './builders/UserMother.js';
import { CarrinhoBuilder } from './builders/CarrinhoBuilder.js';

describe('CheckoutService', () => {

    // Etapa 4: Padrão Stub — Verificação de Estado
    describe('quando o pagamento falha', () => {
        it('deve retornar null', async () => {
            // Arrange
            const cartaoCredito = { numero: '1234-5678-9012-3456' };
            const carrinho = new CarrinhoBuilder().build();

            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: false }) };
            const repositoryDummy = {};
            const emailDummy = {};

            const checkoutService = new CheckoutService(gatewayStub, repositoryDummy, emailDummy);

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, cartaoCredito);

            // Assert — verificação de estado
            expect(pedido).toBeNull();
        });

        it('não deve chamar o EmailService nem o PedidoRepository', async () => {
            // Arrange
            const cartaoCredito = { numero: '1234-5678-9012-3456' };
            const carrinho = new CarrinhoBuilder().build();

            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: false }) };
            const repositoryMock = { salvar: jest.fn() };
            const emailMock = { enviarEmail: jest.fn() };

            const checkoutService = new CheckoutService(gatewayStub, repositoryMock, emailMock);

            // Act
            await checkoutService.processarPedido(carrinho, cartaoCredito);

            // Assert — verificação de comportamento
            expect(repositoryMock.salvar).not.toHaveBeenCalled();
            expect(emailMock.enviarEmail).not.toHaveBeenCalled();
        });
    });

    // Etapa 5: Padrão Mock — Verificação de Comportamento
    describe('quando um cliente Premium finaliza a compra', () => {
        it('deve aplicar 10% de desconto e enviar e-mail de confirmação', async () => {
            // Arrange
            const cartaoCredito = { numero: '9876-5432-1098-7654' };
            const usuarioPremium = UserMother.umUsuarioPremium();
            const carrinho = new CarrinhoBuilder()
                .comUser(usuarioPremium)
                .comItens([new Item('Produto A', 100), new Item('Produto B', 100)])
                .build();

            const pedidoSalvo = new Pedido(42, carrinho, 180, 'PROCESSADO');

            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            const repositoryStub = { salvar: jest.fn().mockResolvedValue(pedidoSalvo) };
            const emailMock = { enviarEmail: jest.fn().mockResolvedValue(undefined) };

            const checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailMock);

            // Act
            const resultado = await checkoutService.processarPedido(carrinho, cartaoCredito);

            // Assert — verificação de comportamento
            expect(gatewayStub.cobrar).toHaveBeenCalledWith(180, cartaoCredito);

            expect(emailMock.enviarEmail).toHaveBeenCalledTimes(1);
            expect(emailMock.enviarEmail).toHaveBeenCalledWith(
                'premium@email.com',
                'Seu Pedido foi Aprovado!',
                expect.any(String)
            );

            expect(resultado).toBe(pedidoSalvo);
        });
    });

    // Verificação de Estado adicional: cliente padrão sem desconto
    describe('quando um cliente Padrão finaliza a compra', () => {
        it('deve retornar o pedido salvo com o totalFinal correto (sem desconto)', async () => {
            // Arrange
            const cartaoCredito = { numero: '1111-2222-3333-4444' };
            const carrinho = new CarrinhoBuilder()
                .comItens([new Item('Produto C', 150)])
                .build();

            const pedidoSalvo = new Pedido(10, carrinho, 150, 'PROCESSADO');

            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            const repositoryStub = { salvar: jest.fn().mockResolvedValue(pedidoSalvo) };
            const emailStub = { enviarEmail: jest.fn().mockResolvedValue(undefined) };

            const checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailStub);

            // Act
            const resultado = await checkoutService.processarPedido(carrinho, cartaoCredito);

            // Assert — verificação de estado
            expect(gatewayStub.cobrar).toHaveBeenCalledWith(150, cartaoCredito);
            expect(resultado).toBe(pedidoSalvo);
            expect(resultado.totalFinal).toBe(150);
        });
    });
});

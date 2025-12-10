import Redis from 'ioredis';
import { config } from '../config';
import { Cart, CartItem, AddToCartRequest } from '../types/cart';

const redis = new Redis(config.redis.url);

const CART_PREFIX = 'cart:';
const CART_TTL = config.cart.ttl;

function getCartKey(userId: string): string {
  return `${CART_PREFIX}${userId}`;
}

function calculateTotals(items: CartItem[]): { totalItems: number; totalAmount: number } {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return { totalItems, totalAmount: Math.round(totalAmount * 100) / 100 };
}

export class CartService {
  async getCart(userId: string): Promise<Cart> {
    const cartKey = getCartKey(userId);
    const cartData = await redis.get(cartKey);

    if (!cartData) {
      return {
        userId,
        items: [],
        totalItems: 0,
        totalAmount: 0,
        currency: 'CNY',
        updatedAt: new Date().toISOString(),
      };
    }

    const cart = JSON.parse(cartData) as Cart;
    return cart;
  }

  async addItem(userId: string, item: AddToCartRequest): Promise<Cart> {
    const cart = await this.getCart(userId);

    const existingIndex = cart.items.findIndex(
      (i) => i.productId === item.productId && i.sku === item.sku
    );

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += item.quantity;
      cart.items[existingIndex].price = item.price;
    } else {
      if (cart.items.length >= config.cart.maxItems) {
        throw new Error(`Cart cannot exceed ${config.cart.maxItems} items`);
      }

      cart.items.push({
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        imageUrl: item.imageUrl,
        addedAt: new Date().toISOString(),
      });
    }

    const { totalItems, totalAmount } = calculateTotals(cart.items);
    cart.totalItems = totalItems;
    cart.totalAmount = totalAmount;
    cart.updatedAt = new Date().toISOString();

    await this.saveCart(userId, cart);
    return cart;
  }

  async updateItemQuantity(
    userId: string,
    productId: string,
    sku: string,
    quantity: number
  ): Promise<Cart> {
    const cart = await this.getCart(userId);

    const itemIndex = cart.items.findIndex(
      (i) => i.productId === productId && i.sku === sku
    );

    if (itemIndex < 0) {
      throw new Error('Item not found in cart');
    }

    if (quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = quantity;
    }

    const { totalItems, totalAmount } = calculateTotals(cart.items);
    cart.totalItems = totalItems;
    cart.totalAmount = totalAmount;
    cart.updatedAt = new Date().toISOString();

    await this.saveCart(userId, cart);
    return cart;
  }

  async removeItem(userId: string, productId: string, sku: string): Promise<Cart> {
    const cart = await this.getCart(userId);

    const itemIndex = cart.items.findIndex(
      (i) => i.productId === productId && i.sku === sku
    );

    if (itemIndex < 0) {
      throw new Error('Item not found in cart');
    }

    cart.items.splice(itemIndex, 1);

    const { totalItems, totalAmount } = calculateTotals(cart.items);
    cart.totalItems = totalItems;
    cart.totalAmount = totalAmount;
    cart.updatedAt = new Date().toISOString();

    await this.saveCart(userId, cart);
    return cart;
  }

  async clearCart(userId: string): Promise<void> {
    const cartKey = getCartKey(userId);
    await redis.del(cartKey);
  }

  async mergeCarts(guestId: string, userId: string): Promise<Cart> {
    const guestCart = await this.getCart(guestId);
    const userCart = await this.getCart(userId);

    for (const guestItem of guestCart.items) {
      const existingIndex = userCart.items.findIndex(
        (i) => i.productId === guestItem.productId && i.sku === guestItem.sku
      );

      if (existingIndex >= 0) {
        userCart.items[existingIndex].quantity += guestItem.quantity;
      } else {
        if (userCart.items.length < config.cart.maxItems) {
          userCart.items.push(guestItem);
        }
      }
    }

    const { totalItems, totalAmount } = calculateTotals(userCart.items);
    userCart.totalItems = totalItems;
    userCart.totalAmount = totalAmount;
    userCart.updatedAt = new Date().toISOString();

    await this.saveCart(userId, userCart);
    await this.clearCart(guestId);

    return userCart;
  }

  private async saveCart(userId: string, cart: Cart): Promise<void> {
    const cartKey = getCartKey(userId);
    await redis.setex(cartKey, CART_TTL, JSON.stringify(cart));
  }
}

export const cartService = new CartService();

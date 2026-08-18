export const paymentService = {
  verifyStock: async (items: { product: { stock: number; name: string }; quantity: number }[]) => {
    const unavailable = items.find((item) => item.quantity > item.product.stock);
    if (unavailable) {
      throw new Error(`${unavailable.product.name} does not have enough stock.`);
    }
    return true;
  },
  processPayment: async () => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    return { id: `pay-${Date.now()}`, status: "success" as const };
  }
};

// Tiny Shop: a fake shop for testing Replay. It shows products, keeps a cart, and has a
// checkout button. It contains ONE BUG ON PURPOSE (see checkout below) for the AI to find later.
import { startRecording } from "@replay/recorder";

// Start recording this visit. If the API isn't running, the shop still works, just unrecorded.
startRecording({ apiUrl: "http://localhost:4000" })
  .then(({ sessionId }) => console.log(`Replay: recording session ${sessionId}`))
  .catch((error) => console.warn("Replay: not recording", error));

type Product = { id: number; name: string; price: number };

const products: Product[] = [
  { id: 1, name: "☕ Coffee mug", price: 12 },
  { id: 2, name: "👕 T-shirt", price: 25 },
  { id: 3, name: "🎧 Headphones", price: 89 },
];

// The cart: product id → how many.
const cart = new Map<number, number>();

// Find an element on the page, or stop with a clear error if index.html doesn't have it.
function $(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element;
}

function cartTotal(): number {
  let total = 0;
  for (const [id, quantity] of cart) {
    total += products.find((p) => p.id === id)!.price * quantity;
  }
  return total;
}

function renderProducts(): void {
  $("products").innerHTML = products
    .map(
      (p) => `<li><span class="item"><span class="name">${p.name}</span>
        <span class="price">$${p.price}</span></span>
        <button data-add="${p.id}">Add to cart</button></li>`,
    )
    .join("");
}

function renderCart(): void {
  const lines = [...cart].map(([id, quantity]) => {
    const product = products.find((p) => p.id === id)!;
    return `<li><span>${product.name} × ${quantity}</span>
      <button class="remove" data-remove="${id}">Remove</button></li>`;
  });
  $("cart").innerHTML = lines.join("") || "<li>Empty</li>";
  $("total").textContent = `$${cartTotal()}`;
}

// One click listener for all "Add" and "Remove" buttons.
document.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest("button");
  if (!button) return;

  if (button.dataset.add) {
    const id = Number(button.dataset.add);
    cart.set(id, (cart.get(id) ?? 0) + 1);
  } else if (button.dataset.remove) {
    cart.delete(Number(button.dataset.remove));
  } else {
    return;
  }
  $("message").textContent = "";
  renderCart();
});

$("checkout").addEventListener("click", () => {
  if (cart.size === 0) {
    $("message").textContent = "Your cart is empty.";
    return;
  }

  // 🐛 THE BUG, ON PURPOSE: orders over $100 silently fail. The visitor clicks and nothing
  // happens at all: no error message, no success. Real users then click again and again
  // ("rage clicks"). Replay's AI should spot this pattern in Phase 5.
  if (cartTotal() > 100) {
    return;
  }

  cart.clear();
  renderCart();
  $("message").textContent = "✅ Order placed! Thanks for shopping.";
});

renderProducts();
renderCart();

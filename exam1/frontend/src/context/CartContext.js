import React, { createContext, useContext, useReducer } from "react";

const CartContext = createContext();

export const cartReducer = (state, action) => {
  switch (action.type) {
    case "ADD_TO_CART": {
      const quantity = action.payload.quantity ?? 1;
      if (!Number.isSafeInteger(quantity) || quantity < 1) return state;
      const existing = state.cart.find(item => item.id === action.payload.id);
      const stock = existing ? existing.stock : action.payload.stock;
      if (!Number.isSafeInteger(stock) || stock < 1) return state;
      if (existing) {
        return { ...state, cart: state.cart.map(item => item.id === action.payload.id
          ? { ...item, quantity: Math.min(item.quantity + quantity, stock) } : item) };
      }
      return { ...state, cart: [...state.cart, { ...action.payload, quantity: Math.min(quantity, stock) }] };
    }

    case "DECREMENT_QUANTITY":
      return {
        ...state,
        cart: state.cart.map((item) =>
          item.id === action.payload.id
            ? { ...item, quantity: Math.max(item.quantity - 1, 1) } // Ne peut pas être inférieur à 1
            : item
        ),
      };

    case "REMOVE_FROM_CART":
      return {
        ...state,
        cart: state.cart.filter((item) => item.id !== action.payload.id),
      };

    case "CLEAR_CART":
      return { ...state, cart: [] };

    case "SET_SHIPPING_METHOD":
      return { ...state, shippingMethod: action.payload };

    case "SET_PAYMENT_METHOD":
      return { ...state, paymentMethod: action.payload };
    case "SET_SHIPPING_ADDRESS":
      return { ...state, shippingAddress: action.payload };
    default:
      return state;
  }
};

export const CartProvider = ({ children }) => {

  const [cartState, dispatch] = useReducer(cartReducer, {
    cart: [],
    shippingMethod: "colissimo",
    paymentMethod: "Carte bancaire",
    shippingAddress: {
      street: "",
      city: "",
      postalCode: "",
      country: "",
    },
  });

  return (
    <CartContext.Provider value={{ ...cartState, dispatch }}>
      {children}
    </CartContext.Provider>
  );
  
};

export const useCart = () => useContext(CartContext);

import { createContext, useContext, useReducer } from 'react';

const OrderContext = createContext();

const orderReducer = (state, action) => {
    switch (action.type) {
        case 'SET_ORDERS':
            return { ...state, orders: action.payload };
        case 'UPDATE_ORDER':
            return {
                ...state,
                orders: state.orders.map(order =>
                    order.codigo === action.payload.codigo ? action.payload : order
                )
            };
        case 'SET_LOADING':
            return { ...state, loading: action.payload };
        case 'SET_ERROR':
            return { ...state, error: action.payload };
        default:
            return state;
    }
};

export const OrderProvider = ({ children }) => {
    const [state, dispatch] = useReducer(orderReducer, {
        orders: [],
        loading: false,
        error: null
    });

    return (
        <OrderContext.Provider value={{ state, dispatch }}>
            {children}
        </OrderContext.Provider>
    );
};

export const useOrderContext = () => {
    const context = useContext(OrderContext);
    if (!context) {
        throw new Error('useOrderContext must be used within OrderProvider');
    }
    return context;
};
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Inventory from './views/Inventory';
import Order from "./views/Order.tsx";
import Supplier from "./views/Supplier.tsx";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/order" element={<Order />} />
                <Route path="/supplier" element={<Supplier />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
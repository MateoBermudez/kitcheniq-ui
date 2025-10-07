import {type ToastContextType} from '../context/toastContext.ts';
import {useToast} from "../components/hooks/useToast.ts";
import SupplierStatus from "../components/SupplierStatus/SupplierStatus.tsx";

function Supplier() {
    const { showSuccess, showError, showWarning, showInfo } : ToastContextType = useToast();

    const handleToast = (message: string, type = 'info') => {
        switch (type) {
            case 'success': return showSuccess(message);
            case 'danger': return showError(message);
            case 'warning': return showWarning(message);
            default: return showInfo(message);
        }
    };

    return <SupplierStatus onToast={handleToast} />;
}

export default Supplier;

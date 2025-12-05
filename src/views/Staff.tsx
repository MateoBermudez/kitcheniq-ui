import type {ToastContextType} from "../context/toastContext.ts";
import {useToast} from "../components/hooks/useToast.ts";
import StaffStatus from "../components/StaffStatus/StaffStatus.tsx";

function Staff() {
    const { showSuccess, showError, showWarning, showInfo } : ToastContextType = useToast();

    const handleToast = (message: string, type = 'info') => {
        switch (type) {
            case 'success': return showSuccess(message);
            case 'danger': return showError(message);
            case 'warning': return showWarning(message);
            default: return showInfo(message);
        }
    };

    return <StaffStatus onToast={handleToast} />;
}

export default Staff;
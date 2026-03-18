import { useState } from 'react';

function Button({ children, className = "", ...props }) {
    const [isActive, setIsActive] = useState(false);
    const isAlwaysActive = className.includes('always-active');

    return (
    <button
        type="button"
        onClick={() => setIsActive(!isActive)}
        className={`btn ${isActive || isAlwaysActive ? 'btn-toggled' : ''} ${className}`}
        {...props}
    >
        {children}
    </button>
    );
}

export default Button;
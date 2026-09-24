import { useCallback, useEffect, useRef, useState } from "react";
import { ToastContext } from "./toastContext";

const VISIBLE_MS = 4500;

export default function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const nextId = useRef(0);
  const timers = useRef(new Set());

  const toast = useCallback((text, kind = "ok") => {
    const id = nextId.current++;
    setItems((list) => [...list, { id, text, kind }]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setItems((list) => list.filter((item) => item.id !== id));
    }, VISIBLE_MS);
    timers.current.add(timer);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast toast-${item.kind}`}>
            {item.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

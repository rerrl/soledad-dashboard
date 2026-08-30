"use client";
import { useEffect, useRef } from "react";
export default function PrintTrigger() {
  const printed = useRef(false);
  useEffect(() => {
    if (!printed.current) {
      printed.current = true;
      window.print();
    }
  }, []);
  return null;
}
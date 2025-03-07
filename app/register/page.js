"use client";

import { useRouter } from "next/navigation";
import { FaArrowLeft } from "react-icons/fa";
import Link from "next/link";

export default function Register() {
  const router = useRouter();

  const navigateTo = (path) => {
    router.push("/register" + path);
  };

  return (
    <div className="min-h-screen flex flex-col items-start justify-start bg-black p-4">
      <Link href="/">
        <button className="bg-gray-500 px-3 py-1 mb-4 rounded-lg hover:opacity-80 flex items-center gap-2">
          <FaArrowLeft /> Volver
        </button>
      </Link>
      <div className="w-full flex flex-col items-center justify-center">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Registros por Actividad
        </h1>
        <div className="flex flex-col gap-4">
          <button
            onClick={() => navigateTo("/arrival")}
            className="px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Registro de Arribos y Servicio
          </button>
          <button
            onClick={() => navigateTo("/products")}
            className="px-6 py-3 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Registro de Productos
          </button>
          <button
            onClick={() => navigateTo("/tables")}
            className="px-6 py-3 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Registro de Mesas
          </button>
        </div>
      </div>
    </div>
  );
}

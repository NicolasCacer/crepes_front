"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black">
      <h1 className="text-3xl font-bold mb-6 text-white">
        Gestión de Registros
      </h1>
      <div className="space-x-4">
        <button
          className="bg-blue-500 text-white px-6 py-2 rounded-lg shadow-md hover:bg-blue-600"
          onClick={() => router.push("/register")}
        >
          Registrar Datos
        </button>
        <button
          className="bg-green-500 text-white px-6 py-2 rounded-lg shadow-md hover:bg-green-600"
          onClick={() => router.push("/data")}
        >
          Ver Datos
        </button>
      </div>
    </div>
  );
}

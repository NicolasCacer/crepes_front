"use client";

import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import Link from "next/link";
import Swal from "sweetalert2";
import { FaArrowLeft } from "react-icons/fa";

const socket = io(process.env.NEXT_PUBLIC_API_URL);

export default function RegistrosCombinados() {
  const [arribos, setArribos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [mesas, setMesas] = useState([]);

  useEffect(() => {
    // Use "arribo" (singular) to match your Firestore collection
    socket.emit("get_persisted_arribo");
    socket.emit("get_persisted_productos");
    socket.emit("get_persisted_mesas");

    socket.on("update_persisted_arribo", setArribos);
    socket.on("update_persisted_productos", setProductos);
    socket.on("update_persisted_mesas", setMesas);

    return () => {
      socket.off("update_persisted_arribo");
      socket.off("update_persisted_productos");
      socket.off("update_persisted_mesas");
    };
  }, []);

  const handleDelete = async (collection, id) => {
    const confirm = await Swal.fire({
      title: "¿Eliminar registro?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (confirm.isConfirmed) {
      // Emit only the ID, as your server code expects.
      socket.emit("eliminar_registro_persistido_" + collection, id);
      Swal.fire("Eliminado", "Registro eliminado con éxito", "success");
    }
  };
  function getAllColumns(data) {
    const columnsSet = new Set();
    data.forEach((item) => {
      Object.keys(item).forEach((key) => {
        columnsSet.add(key);
      });
    });
    return Array.from(columnsSet); // convert Set to Array
  }

  const renderTable = (title, data, collection) => {
    // If there's data, gather all unique columns
    const columns = data.length > 0 ? getAllColumns(data) : [];

    return (
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-2">{title}</h2>
        <div className="overflow-x-auto max-w-full max-h-[200px] overflow-auto">
          <table className="border-collapse border border-gray-300 w-full">
            <thead className="sticky top-0 bg-black text-white">
              <tr>
                {columns.map((col, index) => (
                  <th
                    key={index}
                    className="border border-gray-300 p-2 min-w-[150px]"
                  >
                    {col}
                  </th>
                ))}
                <th className="border border-gray-300 p-2 min-w-[100px]">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id} className="text-center">
                  {columns.map((col, index) => (
                    <td key={index} className="border border-gray-300 p-2">
                      {typeof item[col] === "object" && item[col] !== null
                        ? JSON.stringify(item[col])
                        : item[col] ?? "-"}
                    </td>
                  ))}
                  <td className="border border-gray-300 p-2">
                    <button
                      className="bg-red-500 text-white px-2 py-1 rounded"
                      onClick={() => handleDelete(collection, item.id)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  return (
    <div className="p-6 bg-black text-white overflow-auto">
      <Link href="/">
        <button className="bg-gray-500 px-3 py-1 mb-4 rounded-lg hover:opacity-80 flex items-center gap-2">
          <FaArrowLeft /> Volver
        </button>
      </Link>
      <h1 className="text-2xl font-bold mb-6">Registros Combinados</h1>

      {/* Use "arribo" as collection name */}
      {renderTable("Arribos", arribos, "arribo")}
      {renderTable("Productos", productos, "productos")}
      {renderTable("Mesas", mesas, "mesas")}
    </div>
  );
}

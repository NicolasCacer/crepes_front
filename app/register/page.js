"use client";

import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import Swal from "sweetalert2";
import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa";

// Inicializamos el socket
const socket = io(process.env.NEXT_PUBLIC_API_URL);

// Obtiene la hora actual formateada
function getCurrentTime() {
  return new Date().toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

// Genera un ID único (solo para uso en la tabla temporal)
function getUniqueId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  } else {
    return Date.now().toString() + "_" + Math.random().toString(36).slice(2);
  }
}

// Crea una fila en blanco, con productos agrupados y bandera isEditing
function createBlankRow() {
  return {
    id: getUniqueId(),
    descripcion: "",
    tiempos: {
      arribo: getCurrentTime(), // Se llena automáticamente
      inicioAtencionCaja: null,
      inicioProcesoPago: null,
      finPago: null,
      llamado: null,
      entregaPedido: null,
      ocuparMesa: null,
      liberacionMesa: null,
    },
    productos: {
      helados: 0,
      copas: 0,
      gofres: 0,
      bebidas: 0,
      crepes: 0,
    },
    turnoAsignado: "",
    consumoInterno: false,
    observacion: "",
    isEditing: false, // Bandera para evitar sobrescritura mientras se edita
  };
}

export default function Registros() {
  // Estado inicial vacío para evitar problemas de hidratación
  const [rows, setRows] = useState([]);

  useEffect(() => {
    socket.emit("get_registros");

    // El servidor envía la lista actualizada de filas. Se preserva la edición
    socket.on("update_registros", (data) => {
      setRows((prevRows) =>
        data.map((remoteRow) => {
          const localRow = prevRows.find((r) => r.id === remoteRow.id);
          return localRow && localRow.isEditing ? localRow : remoteRow;
        })
      );
    });

    return () => {
      socket.off("update_registros");
    };
  }, []);

  // Actualiza la bandera isEditing en una fila
  const setRowEditing = (rowIndex, isEditing) => {
    const newRows = [...rows];
    newRows[rowIndex].isEditing = isEditing;
    setRows(newRows);
  };

  const handleSetTime = (rowIndex, campoTiempo) => {
    const newRows = [...rows];
    newRows[rowIndex].tiempos[campoTiempo] = getCurrentTime();
    setRows(newRows);
    socket.emit("actualizar_registro", {
      id: newRows[rowIndex].id,
      data: { tiempos: newRows[rowIndex].tiempos },
    });
  };

  const handleDescriptionChange = (rowIndex, value) => {
    const newRows = [...rows];
    newRows[rowIndex].descripcion = value;
    setRows(newRows);
    socket.emit("actualizar_registro", {
      id: newRows[rowIndex].id,
      data: { descripcion: value },
    });
  };

  const handleObservationChange = (rowIndex, value) => {
    const newRows = [...rows];
    newRows[rowIndex].observacion = value;
    setRows(newRows);
    socket.emit("actualizar_registro", {
      id: newRows[rowIndex].id,
      data: { observacion: value },
    });
  };

  const handleTurnoChange = (rowIndex, value) => {
    const newRows = [...rows];
    newRows[rowIndex].turnoAsignado = value;
    setRows(newRows);
    socket.emit("actualizar_registro", {
      id: newRows[rowIndex].id,
      data: { turnoAsignado: value },
    });
  };

  const handleConsumoChange = (rowIndex, value) => {
    const newRows = [...rows];
    newRows[rowIndex].consumoInterno = value === "si";
    setRows(newRows);
    socket.emit("actualizar_registro", {
      id: newRows[rowIndex].id,
      data: { consumoInterno: newRows[rowIndex].consumoInterno },
    });
  };

  const handleCantidadChange = (rowIndex, producto, value) => {
    const newRows = [...rows];
    newRows[rowIndex].productos[producto] = parseInt(value) || 0;
    setRows(newRows);
    socket.emit("actualizar_registro", {
      id: newRows[rowIndex].id,
      data: { productos: newRows[rowIndex].productos },
    });
  };

  // Al enviar, se arma el objeto a guardar sin el id ni la bandera isEditing,
  // se emite el guardado y se elimina la fila de la tabla.
  const handleSubmit = (rowIndex) => {
    const row = rows[rowIndex];

    // Validate required times (excluding ocuparMesa and liberacionMesa)
    const requiredTimes = [
      "arribo",
      "inicioAtencionCaja",
      "inicioProcesoPago",
      "finPago",
      "llamado",
      "entregaPedido",
    ];
    const tiemposCompletos = requiredTimes.every(
      (campo) => row.tiempos[campo] !== null
    );
    if (!tiemposCompletos) {
      Swal.fire({
        icon: "warning",
        title: "Faltan tiempos",
        text: "Por favor, asegúrate de que todos los tiempos requeridos estén registrados (excepto ocupar y liberar mesa).",
      });
      return;
    }

    // Validate at least one product has a quantity greater than 0
    const tieneProducto = Object.values(row.productos).some(
      (cantidad) => cantidad > 0
    );
    if (!tieneProducto) {
      Swal.fire({
        icon: "warning",
        title: "Sin productos",
        text: "Por favor, ingresa al menos 1 producto en alguna categoría.",
      });
      return;
    }

    // Extraemos id e isEditing para que no se guarden en la base de datos
    const { id, isEditing, ...rest } = row;
    const dataToSend = {
      ...rest,
      productos: { ...row.productos },
    };

    socket.emit("guardar_registro", {
      data: dataToSend,
    });

    // Eliminamos la fila de la tabla local
    const newRows = rows.filter((_, index) => index !== rowIndex);
    setRows(newRows);

    // Informamos al servidor para que otros clientes eliminen la fila
    socket.emit("eliminar_registro", id);

    Swal.fire({
      position: "top-end",
      icon: "success",
      title: "Registro enviado",
      showConfirmButton: false,
      timer: 1000,
    });
  };

  const handleAddRow = () => {
    const newRow = createBlankRow();
    const updatedRows = [...rows, newRow];
    setRows(updatedRows);
    socket.emit("nuevo_registro", newRow);
  };

  // Al eliminar una fila (botón de eliminar)
  const handleDeleteRow = (rowIndex) => {
    Swal.fire({
      title: "¿Eliminar fila?",
      text: "Esta acción eliminará la fila de forma permanente.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed) {
        const rowToDelete = rows[rowIndex];
        const updatedRows = rows.filter((_, index) => index !== rowIndex);
        setRows(updatedRows);
        socket.emit("eliminar_registro", rowToDelete.id);
        Swal.fire("Eliminado", "La fila ha sido eliminada", "success");
      }
    });
  };

  return (
    <div className="p-6">
      <Link href="/">
        <button className="bg-gray-500 px-3 py-1 mb-4 rounded-lg hover:opacity-80 flex items-center gap-2">
          <FaArrowLeft /> Volver
        </button>
      </Link>
      <h1 className="text-xl font-bold mb-4">Registro de Tiempos</h1>
      <table className="w-full border-separate border-spacing-y-4 border-gray-300">
        <thead className="sticky top-0 z-10 bg-black">
          <tr>
            <th className="border border-gray-300 p-2">Descripción</th>
            <th className="border border-gray-300 p-2">Arribo</th>
            <th className="border border-gray-300 p-2">Inicio Atención</th>
            <th className="border border-gray-300 p-2">Productos</th>
            <th className="border border-gray-300 p-2">Inicio Pago</th>
            <th className="border border-gray-300 p-2">Fin Pago</th>
            <th className="border border-gray-300 p-2">Turno</th>
            <th className="border border-gray-300 p-2">Llamado turno</th>
            <th className="border border-gray-300 p-2">Entrega</th>
            <th className="border border-gray-300 p-2">Ocupar Mesa</th>
            <th className="border border-gray-300 p-2">Liberar Mesa</th>
            <th className="border border-gray-300 p-2">Consumo</th>
            <th className="border border-gray-300 p-2">Observación</th>
            <th className="border border-gray-300 p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id} className="text-center mb-2">
              {/* Descripción */}
              <td className="border border-gray-300 p-2">
                <input
                  type="text"
                  value={row.descripcion}
                  onFocus={() => setRowEditing(rowIndex, true)}
                  onBlur={() => setRowEditing(rowIndex, false)}
                  onChange={(e) =>
                    handleDescriptionChange(rowIndex, e.target.value)
                  }
                  className="w-full border rounded p-1"
                  placeholder="Descripción"
                />
              </td>
              {/* Arribo */}
              <td className="border border-gray-300 p-2">
                {row.tiempos.arribo || "-"}
              </td>
              {/* Inicio Atención */}
              <td
                className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSetTime(rowIndex, "inicioAtencionCaja")}
              >
                {row.tiempos.inicioAtencionCaja || "-"}
              </td>
              {/* Productos */}
              <td className="border border-gray-300 p-2 flex flex-col items-end">
                {["helados", "copas", "gofres", "bebidas", "crepes"].map(
                  (tipo) => (
                    <div key={tipo} className="mb-1 flex items-center">
                      <label className="mr-1 text-sm">{tipo}:</label>
                      <input
                        type="number"
                        value={row.productos[tipo]}
                        onFocus={() => setRowEditing(rowIndex, true)}
                        onBlur={() => setRowEditing(rowIndex, false)}
                        onChange={(e) =>
                          handleCantidadChange(rowIndex, tipo, e.target.value)
                        }
                        className="w-16 p-1 border rounded text-center"
                      />
                    </div>
                  )
                )}
              </td>
              {/* Inicio Pago */}
              <td
                className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSetTime(rowIndex, "inicioProcesoPago")}
              >
                {row.tiempos.inicioProcesoPago || "-"}
              </td>
              {/* Fin Pago */}
              <td
                className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSetTime(rowIndex, "finPago")}
              >
                {row.tiempos.finPago || "-"}
              </td>
              {/* Turno */}
              <td className="border border-gray-300 p-2 w-[90px]">
                <input
                  type="text"
                  value={row.turnoAsignado}
                  onFocus={() => setRowEditing(rowIndex, true)}
                  onBlur={() => setRowEditing(rowIndex, false)}
                  onChange={(e) => handleTurnoChange(rowIndex, e.target.value)}
                  className="w-full p-1 border rounded text-center"
                  placeholder="Turno"
                />
              </td>
              {/* Llamado */}
              <td
                className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSetTime(rowIndex, "llamado")}
              >
                {row.tiempos.llamado || "-"}
              </td>
              {/* Entrega */}
              <td
                className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSetTime(rowIndex, "entregaPedido")}
              >
                {row.tiempos.entregaPedido || "-"}
              </td>
              {/* Ocupar Mesa */}
              <td
                className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSetTime(rowIndex, "ocuparMesa")}
              >
                {row.tiempos.ocuparMesa || "-"}
              </td>
              {/* Liberar Mesa */}
              <td
                className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSetTime(rowIndex, "liberacionMesa")}
              >
                {row.tiempos.liberacionMesa || "-"}
              </td>
              {/* Consumo */}
              <td className="border border-gray-300 p-2">
                <select
                  value={row.consumoInterno ? "si" : "no"}
                  onFocus={() => setRowEditing(rowIndex, true)}
                  onBlur={() => setRowEditing(rowIndex, false)}
                  onChange={(e) =>
                    handleConsumoChange(rowIndex, e.target.value)
                  }
                  className="w-full p-1 border rounded text-center"
                >
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </select>
              </td>
              {/* Observación */}
              <td className="border border-gray-300 p-2">
                <input
                  type="text"
                  value={row.observacion}
                  onFocus={() => setRowEditing(rowIndex, true)}
                  onBlur={() => setRowEditing(rowIndex, false)}
                  onChange={(e) =>
                    handleObservationChange(rowIndex, e.target.value)
                  }
                  className="w-full p-1 border rounded"
                  placeholder="Observaciones"
                />
              </td>
              {/* Acciones */}
              <td className="border border-gray-300 p-2">
                <div className="flex">
                  <button
                    className="bg-blue-500 text-white px-3 py-1 rounded mr-2 hover:opacity-80 flex items-center gap-2 font-bold"
                    onClick={() => handleSubmit(rowIndex)}
                  >
                    Enviar
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="15"
                      height="15"
                      viewBox="0 0 15 15"
                    >
                      <path
                        fill="currentColor"
                        d="m14.5.5l.46.197a.5.5 0 0 0-.657-.657zm-14 6l-.197-.46a.5.5 0 0 0-.06.889zm8 8l-.429.257a.5.5 0 0 0 .889-.06zM14.303.04l-14 6l.394.92l14-6zM.243 6.93l5 3l.514-.858l-5-3zM5.07 9.757l3 5l.858-.514l-3-5zm3.889 4.94l6-14l-.92-.394l-6 14zM14.146.147l-9 9l.708.707l9-9z"
                      />
                    </svg>
                  </button>
                  <button
                    className="bg-red-500 text-white p-2 rounded hover:opacity-80"
                    onClick={() => handleDeleteRow(rowIndex)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 2048 2048"
                    >
                      <path
                        fill="currentColor"
                        d="M1792 384h-128v1472q0 40-15 75t-41 61t-61 41t-75 15H448q-40 0-75-15t-61-41t-41-61t-15-75V384H128V256h512V128q0-27 10-50t27-40t41-28t50-10h384q27 0 50 10t40 27t28 41t10 50v128h512zM768 256h384V128H768zm768 128H384v1472q0 26 19 45t45 19h1024q26 0 45-19t19-45zM768 1664H640V640h128zm256 0H896V640h128zm256 0h-128V640h128z"
                      />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        className="mt-4 bg-green-500 text-white px-4 py-2 rounded hover:opacity-80"
        onClick={handleAddRow}
      >
        Agregar Fila
      </button>
    </div>
  );
}

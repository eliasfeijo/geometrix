import { useGame } from "./context.ts";

/** Says what the next click on the map does, while it is not a selection. */
export function ModeBanner() {
  const { store } = useGame();
  const mode = store.mode.value;
  if (mode.type === "select") return null;
  const text =
    mode.type === "pickCell" || mode.type === "pickAlly"
      ? mode.prompt
      : "Modo estrada: botão direito constrói estrada até a célula.";
  return (
    <div class="mode-banner" role="status">
      <span>{text}</span>
      <button onClick={() => (store.mode.value = { type: "select" })}>
        Cancelar (Esc)
      </button>
    </div>
  );
}

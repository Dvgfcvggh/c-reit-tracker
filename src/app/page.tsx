import { Board } from "@/components/reit-board";
import { ThemeProvider } from "@/components/theme";

export default function Page() {
  return (
    <ThemeProvider>
      <Board />
    </ThemeProvider>
  );
}


//`export const Header = () => { ... };` to `export default function Header() { ... }`
export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
      <div className="container flex h-14 items-center">
        {/* Header placeholder */}
      </div>
    </header>
  );
};
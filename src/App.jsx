import { Link, Outlet, useLocation } from "react-router-dom";

function App() {
  const location = useLocation();

  const isActive = (path) => {
    if (path === "/") {
      return location.pathname === "/";
    }

    return location.pathname.startsWith(path);
  };

  const navigation = [
    { path: "/", label: "Home" },
    { path: "/rankings", label: "Rankings" },
    { path: "/players", label: "Players" },
    { path: "/media", label: "Media" },
    { path: "/about", label: "About" },
  ];

  return (
    <div className="min-h-screen bg-[#05070a] text-white">
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#0b0f14]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <Link
            to="/"
            className="text-xl font-bold text-orange-500 transition hover:text-orange-400 md:text-2xl"
          >
            ESEA Tracker
          </Link>

          <div className="flex gap-6 text-sm">
            {navigation.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`border-b pb-1 transition ${
                  isActive(item.path)
                    ? "border-orange-500 text-white"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <Outlet />

      <a
        href="https://t.me/LisssTzz1"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-4 z-50 rounded-full bg-orange-500 px-4 py-3 font-bold text-white shadow-lg transition-colors hover:bg-orange-600"
      >
        💬 Feedback
      </a>
    </div>
  );
}

export default App;
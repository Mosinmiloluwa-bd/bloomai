import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-display font-bold text-foreground">404</h1>
        <p className="text-lg text-muted-foreground">This page doesn't exist in Bloom.</p>
        <a href="/" className="inline-block text-primary font-medium underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;

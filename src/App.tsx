import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Seo from "@/components/Seo";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Leagues from "./pages/Leagues";
import Admin from "./pages/Admin";
import MatchDetails from "./pages/MatchDetails";
import Players from "./pages/Players";
import Profile from "./pages/Profile";
import GlobalProfile from "./pages/GlobalProfile";
import Leaderboard from "./pages/Leaderboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Seo
                  title="Playta – organizacija športnih lig in rekreativnih tekem"
                  description="Playta povezuje rekreativne športne lige: razporejanje tekem, samodejno sestavljanje ekip, lestvice in ocene igralcev za hokej, nogomet, košarko in odbojko."
                />
                <Leagues />
              </>
            }
          />
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/league"
            element={
              <>
                <Seo
                  title="Tekme lige | Playta"
                  description="Pregled prihajajočih in odigranih tekem izbrane lige s prijavami igralcev in vratarjev."
                  noindex
                />
                <Index />
              </>
            }
          />
          <Route
            path="/admin"
            element={
              <>
                <Seo
                  title="Administracija lige | Playta"
                  description="Upravljanje članov, tekem, sezon in nastavitev lige."
                  noindex
                />
                <Admin />
              </>
            }
          />
          <Route
            path="/match/:matchId"
            element={
              <>
                <Seo
                  title="Podrobnosti tekme | Playta"
                  description="Sestava ekip, prijavljeni igralci, rezultat in statistika posamezne tekme."
                  noindex
                />
                <MatchDetails />
              </>
            }
          />
          <Route
            path="/players"
            element={
              <>
                <Seo
                  title="Tekmovalci lige | Playta"
                  description="Seznam tekmovalcev lige z vlogami, statusom plačila in ocenami."
                  noindex
                />
                <Players />
              </>
            }
          />
          <Route
            path="/profile"
            element={
              <>
                <Seo
                  title="Ligaški profil | Playta"
                  description="Vaša statistika, udeležba in napredek v izbrani ligi."
                  noindex
                />
                <Profile />
              </>
            }
          />
          <Route
            path="/global-profile"
            element={
              <>
                <Seo
                  title="Moj račun | Playta"
                  description="Urejanje osebnih podatkov, avatarja, gesla in članstev v ligah."
                  noindex
                />
                <GlobalProfile />
              </>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <>
                <Seo
                  title="Lestvica lige | Playta"
                  description="Lestvica igralcev s točkami, zmagami, goli in udeležbo po sezonah."
                  noindex
                />
                <Leaderboard />
              </>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route
            path="*"
            element={
              <>
                <Seo title="Stran ni najdena | Playta" description="Zahtevana stran ne obstaja." noindex />
                <NotFound />
              </>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

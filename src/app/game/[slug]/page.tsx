import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Calendar, Star, Compass, Tag, Monitor } from "lucide-react";
import { db } from "@/lib/db";
import AuthButton from "@/components/AuthButton";
import TrackControls from "@/components/TrackControls";
import { getServerUser } from "@/lib/serverAuth";

interface GamePageProps {
  params: Promise<{
    slug: string;
  }>;
}

// Enable ISR: Revalidate pages at most once every hour
export const revalidate = 3600;

// Pre-render game profiles at build time
export async function generateStaticParams() {
  try {
    const games = await db.game.findMany({
      select: { slug: true },
    });
    return games.map((game) => ({
      slug: game.slug,
    }));
  } catch (error) {
    console.error("⚠️ generateStaticParams failed:", error);
    return [];
  }
}

export default async function GameProfilePage({ params }: GamePageProps) {
  const resolvedParams = await params;
  const { slug } = resolvedParams;

  // Query game details from database
  const game = await db.game.findUnique({
    where: { slug },
    include: {
      developers: true,
      publishers: true,
      genres: true,
      platforms: true,
      purchaseLinks: true,
    },
  });

  if (!game) {
    notFound();
  }

  // Format rating display
  const ratingDisplay = game.rating ? `${game.rating.toFixed(1)} / 100` : "No rating yet";

  // Fetch the user's wishlist and collection tracking state on the server
  const user = await getServerUser();
  let isWishlisted = false;
  let collectionStatus = null;

  if (user) {
    const wishlistRecord = await db.wishlist.findUnique({
      where: {
        userId_gameId: {
          userId: user.id,
          gameId: game.id,
        },
      },
    });
    isWishlisted = !!wishlistRecord;

    const collectionRecord = await db.collection.findUnique({
      where: {
        userId_gameId: {
          userId: user.id,
          gameId: game.id,
        },
      },
    });
    collectionStatus = collectionRecord ? collectionRecord.status : null;
  }

  // Query related games (matching current game's genres or developers, excluding current game)
  let relatedGames = await db.game.findMany({
    where: {
      id: { not: game.id },
      OR: [
        {
          genres: {
            some: {
              id: { in: game.genres.map((g) => g.id) },
            },
          },
        },
        {
          developers: {
            some: {
              id: { in: game.developers.map((d) => d.id) },
            },
          },
        },
      ],
    },
    take: 4,
    orderBy: [
      { rating: "desc" },
      { releaseDate: "desc" },
    ],
    include: {
      developers: true,
      genres: true,
      platforms: true,
    },
  });

  // Fallback to highest rated if no related games found
  if (relatedGames.length === 0) {
    relatedGames = await db.game.findMany({
      where: {
        id: { not: game.id },
      },
      take: 4,
      orderBy: [
        { rating: "desc" },
        { releaseDate: "desc" },
      ],
      include: {
        developers: true,
        genres: true,
        platforms: true,
      },
    });
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black pb-24">
      {/* Top Sticky Header */}
      <header className="border-b border-white bg-black sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Link href="/" className="hover:opacity-85">
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                <span className="italic">ho</span>GAMEGATA.
              </h1>
            </Link>
            <div className="flex items-center gap-2 font-mono text-[9px] tracking-widest text-white uppercase font-bold">
              <span>Game Profile Spec</span>
              <span className="text-white font-black">•</span>
              <span>Metadata Inspection</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AuthButton />
            <Link 
              href="/" 
              className="group flex items-center gap-2 font-mono text-xs text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-1.5 rounded-none font-bold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>[ &lt;- Return to Search ]</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-6 mt-12 space-y-12">
        {/* Core Layout Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          
          {/* Left Column: Cover & Quick Stats */}
          <div className="md:col-span-1 space-y-6">
            <div className="border border-white bg-black p-1 rounded-none overflow-hidden shrink-0">
              {game.coverUrl ? (
                <img 
                  src={game.coverUrl} 
                  alt={game.title} 
                  className="w-full h-auto object-cover border border-white"
                />
              ) : (
                <div className="aspect-[3/4] w-full bg-gradient-to-b from-white/10 to-black flex items-center justify-center border border-white">
                  <span className="font-mono text-xs uppercase tracking-widest text-white">No Cover Art</span>
                </div>
              )}
            </div>

            {/* Quick Specs Container */}
            <div className="border border-white bg-black p-5 space-y-4 font-mono text-xs font-bold uppercase">
              <span className="font-mono text-[9px] text-white/50 tracking-widest block border-b border-white/20 pb-1">Quick Specs</span>
              
              <div className="flex justify-between items-center">
                <span className="text-white flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Release:</span>
                <span className="text-white font-black">
                  {game.releaseDate ? new Date(game.releaseDate).toLocaleDateString("en-US", { year: "numeric", month: "short" }) : "N/A"}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-white flex items-center gap-1.5"><Star className="w-3.5 h-3.5" /> Rating:</span>
                <span className="text-white font-black">{ratingDisplay}</span>
              </div>

              <div className="flex justify-between items-start gap-4">
                <span className="text-white flex items-center gap-1.5 shrink-0"><Monitor className="w-3.5 h-3.5" /> Systems:</span>
                <span className="text-white font-black text-right line-clamp-2">
                  {game.platforms.map(p => p.name).join(", ")}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Descriptions & Details */}
          <div className="md:col-span-2 space-y-8">
            <div className="space-y-4">
              <span className="font-mono text-[9px] text-white uppercase tracking-widest border border-white px-2 py-0.5 font-bold bg-white text-black w-fit block">
                {game.status}
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight uppercase leading-tight">
                {game.title}
              </h2>
              <div className="flex flex-wrap gap-2 text-xs font-mono font-bold uppercase">
                <span className="text-white/60">Developed by:</span>
                <span className="text-white font-black">{game.developers.map(d => d.name).join(", ")}</span>
                {game.publishers.length > 0 && (
                  <>
                    <span className="text-white/60 ml-2">Published by:</span>
                    <span className="text-white font-black">{game.publishers.map(p => p.name).join(", ")}</span>
                  </>
                )}
              </div>
            </div>

            {/* User registry control tools */}
            <TrackControls
              gameId={game.id}
              gameSlug={game.slug}
              initialWishlisted={isWishlisted}
              initialCollectionStatus={collectionStatus}
            />

            {/* Description Paragraph */}
            <div className="border-t border-white pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-white" />
                <span className="font-mono text-[10px] text-white uppercase tracking-widest font-black">Description & Overview</span>
              </div>
              <p className="text-sm text-white font-medium leading-relaxed font-sans">
                {game.summary || "No overview available for this title."}
              </p>
              {game.storyline && (
                <div className="mt-4 pt-4 border-t border-white/20">
                  <span className="font-mono text-[9px] text-white/50 uppercase tracking-widest block mb-2 font-bold">Storyline Spec</span>
                  <p className="text-xs text-white leading-relaxed font-sans font-medium">
                    {game.storyline}
                  </p>
                </div>
              )}
            </div>

            {/* Genre & Tag badging */}
            <div className="border-t border-white pt-6 flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-white uppercase tracking-widest font-black">
                <Tag className="w-3.5 h-3.5" /> Genres:
              </div>
              <div className="flex flex-wrap gap-2">
                {game.genres.map(genre => (
                  <span key={genre.slug} className="border border-white text-white font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 font-bold">
                    {genre.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Purchase Outlinks */}
            {game.purchaseLinks.length > 0 && (
              <div className="border-t border-white pt-6 space-y-4">
                <span className="font-mono text-[10px] text-white uppercase tracking-widest font-black block">Developer Outlinks</span>
                <div className="flex flex-wrap gap-3">
                  {game.purchaseLinks.map(link => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2 font-mono text-[10px] text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-2 font-bold"
                    >
                      <ExternalLink className="w-3 h-3 text-white group-hover:text-black" />
                      <span>Support Creator ({link.storeName})</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Screenshots Gallery (If available) */}
        {game.screenshots.length > 0 && (
          <section className="border-t border-white pt-12 space-y-6">
            <h3 className="font-mono text-[10px] text-white uppercase tracking-widest font-black">Screenshots Spec</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {game.screenshots.map((url, i) => (
                <div key={i} className="border border-white bg-black p-1 hover:bg-white transition-colors duration-150">
                  <img
                    src={url}
                    alt={`${game.title} screenshot ${i + 1}`}
                    className="w-full h-auto object-cover border border-white hover:opacity-95 transition-opacity"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Embedded Trailer Video (If available) */}
        {game.trailerUrl && (
          <section className="border-t border-white pt-12 space-y-6">
            <h3 className="font-mono text-[10px] text-white uppercase tracking-widest font-black">Media Trailer Embed</h3>
            <div className="border border-white bg-black p-1 aspect-video w-full max-w-3xl mx-auto">
              <iframe
                src={game.trailerUrl}
                title={`${game.title} trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border border-white"
              ></iframe>
            </div>
          </section>
        )}

        {/* Similar Games Section */}
        {relatedGames.length > 0 && (
          <section className="border-t border-white pt-12 space-y-6">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-white" />
              <h3 className="font-mono text-[10px] text-white uppercase tracking-widest font-black">Related Specifications</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {relatedGames.map((relatedGame) => (
                <Link
                  key={relatedGame.slug}
                  href={`/game/${relatedGame.slug}`}
                  className="border border-white bg-black rounded-none overflow-hidden hover:bg-white hover:text-black group transition-all duration-150 flex flex-col h-full"
                >
                  {/* Cover Image */}
                  <div className="h-48 bg-black relative border-b border-white overflow-hidden shrink-0 flex items-center justify-center">
                    {relatedGame.coverUrl ? (
                      <img
                        src={relatedGame.coverUrl}
                        alt={relatedGame.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-b from-white/10 to-black flex items-center justify-center">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-white">No Cover</span>
                      </div>
                    )}
                    {/* Primary Genre Tag */}
                    <span className="absolute bottom-2 left-2 font-mono text-[8px] uppercase tracking-widest bg-white text-black font-black px-1.5 py-0.5">
                      {relatedGame.genres[0]?.name || "Horror"}
                    </span>
                  </div>

                  {/* Game Details */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="text-white group-hover:text-black text-sm font-bold tracking-wide uppercase line-clamp-1">
                        {relatedGame.title}
                      </h4>
                      <span className="font-mono text-[9px] text-white group-hover:text-black block font-bold mt-1">
                        by {relatedGame.developers[0]?.name || "Unknown Dev"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/20 font-mono text-[9px]">
                      <span className="text-white group-hover:text-black font-bold truncate max-w-[120px]">
                        {relatedGame.platforms.map((p) => p.name).slice(0, 2).join(", ")}
                      </span>
                      <span className="px-1.5 py-0.2 border border-white text-white group-hover:text-black group-hover:border-black font-bold">
                        {relatedGame.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

      </main>
    </div>
  );
}

"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Lock, Plus } from "lucide-react";
import { AuthenticatedGalleryPage } from "../gallery/components/AuthenticatedGalleryPage";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [imageStats, setImageStats] = useState({
    publicCount: 0,
    privateCount: 0,
    totalVotes: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    if (session?.user?.id) {
      loadProfile();
    }
  }, [session, status, router]);

  async function loadProfile() {
    try {
      const response = await fetch(`/api/user/profile/${session?.user?.id}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
        setImageStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setIsLoading(false);
    }
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!session?.user) return null;

  const initials = (session.user.name || session.user.email)
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24">
      {/* Cover Photo Banner */}
      <div className="relative h-48 bg-gray-900 border-b border-gray-800 group overflow-hidden">
        {profile?.coverPhotoUrl ? (
          <img
            src={profile.coverPhotoUrl}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-gray-900 to-gray-800" />
        )}

        {/* Edit overlay on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => router.push("/profile")}
            className="bg-gray-800 text-white hover:bg-gray-700"
          >
            Change Cover
          </Button>
        </div>
      </div>

      {/* Profile Card */}
      <div className="max-w-6xl mx-auto px-4 -mt-16 relative z-10 mb-8">
        <Card className="bg-gray-900 border-gray-800 p-6">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <Avatar className="w-24 h-24 border-4 border-gray-950">
              <AvatarImage
                src={profile?.avatarUrl || session.user.image || ""}
                alt={session.user.name || "User"}
              />
              <AvatarFallback className="bg-gray-800 text-white text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>

            {/* Profile Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold">
                  {session.user.name || "User"}
                </h1>
                {profile?.username && (
                  <span className="text-gray-400">@{profile.username}</span>
                )}
                {profile?.creatorVerified && (
                  <Badge variant="default" className="bg-blue-600">
                    Verified Creator
                  </Badge>
                )}
              </div>

              {profile?.bio && (
                <p className="text-gray-300 mb-3">{profile.bio}</p>
              )}

              {/* Social Links */}
              {profile?.socialLinks && (
                <div className="flex gap-3 mb-4">
                  {profile.socialLinks.twitter && (
                    <a
                      href={`https://twitter.com/${profile.socialLinks.twitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      Twitter
                    </a>
                  )}
                  {profile.socialLinks.instagram && (
                    <a
                      href={`https://instagram.com/${profile.socialLinks.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pink-400 hover:text-pink-300 text-sm"
                    >
                      Instagram
                    </a>
                  )}
                  {profile.socialLinks.reddit && (
                    <a
                      href={`https://reddit.com/u/${profile.socialLinks.reddit}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-400 hover:text-orange-300 text-sm"
                    >
                      Reddit
                    </a>
                  )}
                  {profile.socialLinks.website && (
                    <a
                      href={profile.socialLinks.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-400 hover:text-green-300 text-sm"
                    >
                      Website
                    </a>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => router.push("/profile")}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Edit Profile
                </Button>
                {!profile?.isCreator && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-700 text-white hover:bg-gray-800"
                    onClick={() => {
                      // Apply for creator
                      fetch("/api/user/apply-creator", { method: "POST" }).then(
                        () => loadProfile()
                      );
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Apply for Creator
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Stats Bar */}
      <div className="max-w-6xl mx-auto px-4 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gray-900 border-gray-800 p-4 text-center">
            <div className="text-2xl font-bold text-white">
              {imageStats.publicCount}
            </div>
            <div className="text-sm text-gray-400">Public Images</div>
          </Card>
          <Card className="bg-gray-900 border-gray-800 p-4 text-center">
            <div className="text-2xl font-bold text-white">
              {imageStats.privateCount}
            </div>
            <div className="text-sm text-gray-400">Private Images</div>
          </Card>
          <Card className="bg-gray-900 border-gray-800 p-4 text-center">
            <div className="text-2xl font-bold text-white">
              {imageStats.totalVotes}
            </div>
            <div className="text-sm text-gray-400">Total Votes</div>
          </Card>
          {profile?.isCreator && (
            <Card className="bg-gray-900 border-gray-800 p-4 text-center">
              <div className="text-2xl font-bold text-white">
                ${(profile.totalEarnings / 100).toFixed(2)}
              </div>
              <div className="text-sm text-gray-400">Total Earnings</div>
            </Card>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4">
        <Tabs defaultValue="public" className="w-full">
          <TabsList className="bg-gray-900 border-b border-gray-800 grid w-full grid-cols-3 lg:grid-cols-3">
            <TabsTrigger
              value="public"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500"
            >
              Public Gallery
            </TabsTrigger>
            <TabsTrigger
              value="private"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500"
            >
              Private Gallery
            </TabsTrigger>
            {profile?.isCreator && (
              <TabsTrigger
                value="creator"
                className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500"
              >
                Creator Tools
              </TabsTrigger>
            )}
          </TabsList>

          {/* Public Gallery */}
          <TabsContent value="public" className="mt-6">
            <AuthenticatedGalleryPage
              userId={session.user.id}
              userMode={false}
            />
          </TabsContent>

          {/* Private Gallery */}
          <TabsContent value="private" className="mt-6">
            <AuthenticatedGalleryPage
              userId={session.user.id}
              userMode={true}
            />
          </TabsContent>

          {/* Creator Tools */}
          {profile?.isCreator && (
            <TabsContent value="creator" className="mt-6">
              <Card className="bg-gray-900 border-gray-800 p-8 text-center">
                <h3 className="text-xl font-bold mb-2">Creator Monetization</h3>
                <p className="text-gray-400 mb-4">
                  Creator monetization features coming soon. Verified creators
                  will be able to set paywalled content, unlock exclusive images
                  and videos, and earn recurring revenue from subscribers.
                </p>
                {profile?.creatorVerified && (
                  <Badge variant="default" className="bg-green-600">
                    You are verified
                  </Badge>
                )}
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

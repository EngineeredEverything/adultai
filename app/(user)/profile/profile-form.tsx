"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, User as UserIcon, Mail, Lock, Camera } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { settings } from "@/actions/user/settings";
import { SettingsSchema } from "@/schemas/settings";
import { getUserImageByEmail } from "@/lib/utils";
import MobileBottomNav from "../gallery/components/mobile-bottom-nav";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GetCurrentUserInfoSuccessType } from "@/types/user";
import { logger } from "@/lib/logger";

const profileFormSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
});

const passwordFormSchema = z
  .object({
    password: z.string().min(1, {
      message: "Current password is required.",
    }),
    newPassword: z.string().min(8, {
      message: "New password must be at least 8 characters.",
    }),
    confirmPassword: z.string().min(8, {
      message: "Confirm password must be at least 8 characters.",
    }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export function ProfileForm({ user }: { user: GetCurrentUserInfoSuccessType }) {
  const [isPending, startTransition] = useTransition();
  const [isPasswordChangePending, startPasswordTransition] = useTransition();
  const [isGoogleProvider, setIsGoogleProvider] = useState(
    user?.user.accounts?.provider === "google"
  );
  const router = useRouter();

  const profileForm = useForm({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user.user?.name || "",
      email: user.user?.email || "",
    },
  });

  const passwordForm = useForm({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      password: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  function onProfileSubmit(values: z.infer<typeof SettingsSchema>) {
    startTransition(async () => {
      const result = await settings({
        name: values.name,
        email: values.email,
      });

      if (result?.error) {
        toast.error(result.error);
      }

      if (result?.success) {
        toast.success(result.success);
      }
    });
  }

  function onPasswordSubmit(values: z.infer<typeof SettingsSchema>) {
    startPasswordTransition(async () => {
      const result = await settings({
        password: values.password,
        newPassword: values.newPassword,
      });

      if (result?.error) {
        toast.error(result.error);
      }

      if (result?.success) {
        toast.success(result.success);

        // Reset password form
        passwordForm.reset({
          password: "",
          newPassword: "",
          confirmPassword: "",
        });
      }
    });
  }

  logger.debug("user?.images ", JSON.stringify(user?.images));

  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="mb-6">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-24 w-24">
              <AvatarImage
                src={
                  (user.images &&
                    user.images?.images.length > 0 &&
                    user.images.images[0].path) ||
                  getUserImageByEmail(user?.user.email, user.user.name) ||
                  ""
                }
                alt={user?.user.name || "User"}
              />
              <AvatarFallback className="text-2xl">
                {user.user?.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            {/* <Button variant="outline" size="sm" className="gap-2">
              <Camera className="h-4 w-4" />
              Change Avatar
            </Button> */}
          </div>

          <div className="flex-1">
            <Form {...profileForm}>
              <form
                onSubmit={profileForm.handleSubmit(onProfileSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={profileForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            className="pl-10"
                            placeholder="Your name"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            className="pl-10"
                            placeholder="Your email"
                            {...field}
                            disabled={isGoogleProvider}
                          />
                        </div>
                      </FormControl>
                      {isGoogleProvider && (
                        <FormDescription>
                          Email cannot be changed when using Google
                          authentication.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button type="submit" disabled={isPending}>
                    {isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="password">
        {!isGoogleProvider ? (
          <Form {...passwordForm}>
            <form
              onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
              className="space-y-6"
            >
              <FormField
                control={passwordForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-10"
                          type="password"
                          placeholder="Your current password"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            className="pl-10"
                            type="password"
                            placeholder="New password"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            className="pl-10"
                            type="password"
                            placeholder="Confirm new password"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isPasswordChangePending}>
                  {isPasswordChangePending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Password
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-6">
                <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  Password Management Unavailable
                </h3>
                <p className="text-muted-foreground">
                  You signed up using Google authentication, so there is no
                  password to change.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>
      {/* Mobile bottom navigation */}
      <div className="md:hidden">
        <MobileBottomNav
          user={
            user
              ? {
                  name: user?.user.name || "",
                  image:
                    (user?.images?.images[0] &&
                      user?.images?.images[0].cdnLink) ||
                    "",
                  role: user?.user.role || null,
                  email: user?.user.email || "",
                }
              : null
          }
          onPlusClick={() => router.push("/gallery?create=true")}
        />
      </div>
    </Tabs>
  );
}

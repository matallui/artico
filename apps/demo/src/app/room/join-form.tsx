"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { useRouter } from "next/navigation";

const formSchema = z.object({
  roomId: z.string().trim().min(3).max(32),
});

export function JoinRoomForm() {
  const router = useRouter();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      roomId: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    router.push(`/room/${values.roomId}`);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="roomId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Room ID</FormLabel>
              <FormControl>
                <Input
                  data-1p-ignore
                  autoComplete="off"
                  placeholder="some-room-id"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                This is the Room ID where you will meet your friends.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Join Room</Button>
      </form>
    </Form>
  );
}

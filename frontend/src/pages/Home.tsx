import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.tsx';
import { Button } from '@/components/ui/button.tsx';

export function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Template</CardTitle>
          <CardDescription>Welcome.</CardDescription>
        </CardHeader>
        <CardContent />
        <CardFooter className="flex justify-between">
          <Button variant="outline">Cancel</Button>
          <Button>Continue</Button>
        </CardFooter>
      </Card>
    </main>
  );
}

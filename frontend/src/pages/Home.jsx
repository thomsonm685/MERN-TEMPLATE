import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Link } from "react-router-dom"

export function HomePage() {
  return (
    <>
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>HI</CardTitle>
        <CardDescription>Hi there.</CardDescription>
      </CardHeader>
      <CardContent>
      {/* <Button asChild>
        <Link to='/create'>Create</Link>
      </Button> */}

      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline">Cancel</Button>
        <Button>Deploy</Button>
      </CardFooter>
    </Card>   
    </>
)
}




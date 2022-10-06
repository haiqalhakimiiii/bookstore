<script>
   import AddBook from "./components/AddBook.svelte";
   import BookList from "./components/BookList.svelte";
   import Footer from "./components/Footer.svelte";
   import Header from "./components/Header.svelte";
   import Jsonplaceholder from "./components/Jsonplaceholder.svelte";
   import Card from "./shared/Card.svelte";

   let count = 0;
</script>

<Header/>
<main>
   <div class="add-book">
      <Card>
         <AddBook/>
      </Card>
   </div>
   
   <div class="bookstore">
     <Card>
         <button on:click={() => count++}>Refresh</button>
         <h3>From mongoDB</h3>
         <p>Books:</p>
         {#key count }
            <BookList/>
         {/key}
         
      </Card>
   </div>
   <div class="jsonplaceholder">
      <Card>
         <h3>From jsonplaceholder</h3>
         <Jsonplaceholder/>
      </Card>
   </div>
   
</main>
<Footer/>
<style>
	main {
      text-align: center;
		max-width: 960px;
		margin: 0 auto;
	}
   .add-book{
      margin-top: 20px;
      margin-bottom: 20px;
   }
   .bookstore{
      margin-bottom: 20px;
   }

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}
</style>
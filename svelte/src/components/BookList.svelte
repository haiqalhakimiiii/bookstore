<script>
   import { onMount } from 'svelte'

   let books = []

   
   onMount(async () => {
      fetch("http://localhost:3000/books")
      .then(response => response.json())
      .then(data => {
            books = data
      }).catch(error => {
         console.log(error);
         return [];
      });
   })

   async function deleteBook(id){
      const res = await fetch('http://localhost:3000/books/'+id,{
            method: 'DELETE',
         })
         const response = await res.json()
   }
   let book = {
         title: '',
         author: '',
         pages: '',
         genres: [],
         rating: ''
      }
   
   let updateID = ''
   let editForm = false
   function editBook(e){
      book = {
         title: e.title,
         author: e.author,
         pages: e.pages,
         genres: e.genres,
         rating: e.rating
      }
      updateID = e._id
      console.log(updateID, 'test updateID')
      editForm = !editForm
   }

   function updateBook(){
      // console.log(book, 'test update')
      // console.log(updateID, 'test id')
      fetch('http://localhost:3000/books/'+updateID,{
         method:  'PATCH',
         headers: {
         'Content-Type': 'application/json'
         },
         body: JSON.stringify(book)
      })
         .then(response => response.json())
         .then(result => console.log(result))
   }

</script>

<div>
   <div class="edit-form">
      {#if editForm}
         <form>
            <input type="text" bind:value={book.title} placeholder="Title">
            <input type="text" bind:value={book.author} placeholder="Author">
            <input type="number" bind:value={book.pages} placeholder="Number of pages">
            <label>
               Genres: <br>
               <input type="checkbox" bind:group={book.genres} value="Action">Action<br>
               <input type="checkbox" bind:group={book.genres} value="Crime">Crime<br>
               <input type="checkbox" bind:group={book.genres} value="Drama">Drama<br>
               <input type="checkbox" bind:group={book.genres} value="Horror">Horror<br>
               <input type="checkbox" bind:group={book.genres} value="Thriller">Thriller<br>
            </label>
            <input type="number" bind:value={book.rating} placeholder="Rating">
            <button on:click={updateBook}>Submit</button>
            <button on:click={editBook}>Close</button>
         </form> 
      {/if}
   </div> 
   <table>
      {#each books as book }
         <tr>
            <td><p>{book._id}</p></td>
            <td><p>{book.title}</p></td>
            <td><button on:click={editBook(book)}>Edit</button></td>
            <td>
               <form><button on:click={deleteBook(book._id)}>Delete</button></form>
            </td>
         </tr>
      {/each}
   </table>
</div>

<style>
   table{
      margin: 0 auto;
   }
   td{
      vertical-align: middle;
      text-align: center;
   }
   .edit-form{
      margin: 0 auto;
      text-align: center;
   }
</style>
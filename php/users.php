<?php

// Admin: the people who can sign in to the admin, so new ones can be added without editing config.php.
//   GET  users.php                            → everyone who can sign in, with the add form
//   GET  users.php?reset=…#user-…             → that person's row with a new-password field
//   POST users.php  action=add                → new user (name, email, password)
//   POST users.php  action=password&id=…      → set a new password
//   POST users.php  action=delete&id=…        → remove them (never yourself)
// The main password in config.php always works too, with the email left empty, so no one can be locked out.

declare(strict_types=1);

require __DIR__ . '/admin-common.php';

const MIN_PASSWORD = 10;

final class UserProblem extends RuntimeException {}

if (!$signedIn) redirect('admin.php');

function newPassword(): string
{
    $new = (string) ($_POST['password'] ?? '');
    if (strlen($new) < MIN_PASSWORD) throw new UserProblem('Passwords need at least ' . MIN_PASSWORD . ' characters.');
    return password_hash($new, PASSWORD_DEFAULT);
}

$me = (int) ($_SESSION['admin_user'] ?? 0);

// ---------- form actions (each ends in a redirect, so a refresh never repeats it) ----------

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!validCsrf()) {
        flash('That form had expired. Please try again.', 'error');
        redirect('users.php');
    }
    $action = (string) ($_POST['action'] ?? '');
    $id = (int) ($_POST['id'] ?? 0);
    $back = 'users.php';
    try {
        $pdo = db();
        adminUsersTable($pdo);

        if ($action === 'add') {
            $back = 'users.php#add';
            $name = trim((string) ($_POST['name'] ?? ''));
            $email = strtolower(trim((string) ($_POST['email'] ?? '')));
            if ($name === '') throw new UserProblem('Add the person\'s name, so you can tell who is who.');
            if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) throw new UserProblem('That isn\'t a valid email address.');
            try {
                $pdo->prepare('INSERT INTO admin_users (name, email, password_hash) VALUES (?, ?, ?)')
                    ->execute([function_exists('mb_substr') ? mb_substr($name, 0, 100) : substr($name, 0, 100), $email, newPassword()]);
            } catch (PDOException $e) {
                // 23000: the unique key refused it.
                if ($e->getCode() === '23000') throw new UserProblem($email . ' can already sign in.');
                throw $e;
            }
            $back = 'users.php#user-' . (int) $pdo->lastInsertId();
            flash("Added {$name}. They sign in with {$email} and the password you set; let them know it.");
        }

        if ($action === 'password') {
            $back = 'users.php?reset=' . $id . '#user-' . $id;
            $statement = $pdo->prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?');
            $statement->execute([newPassword(), $id]);
            $back = 'users.php#user-' . $id;
            flash($statement->rowCount() ? 'Saved the new password.' : 'That person is no longer on the list.');
        }

        if ($action === 'delete') {
            if ($id === $me) throw new UserProblem('You can\'t remove yourself while signed in. Ask someone else to, or sign in with the main password.');
            $statement = $pdo->prepare('DELETE FROM admin_users WHERE id = ?');
            $statement->execute([$id]);
            flash($statement->rowCount() ? 'Removed them. They can no longer sign in.' : 'That person was already removed.');
        }
    } catch (UserProblem $e) {
        flash($e->getMessage(), 'error');
    } catch (Throwable $e) {
        error_log('Users admin failed: ' . $e->getMessage());
        flash('Something went wrong, and that change may not have been saved. Please try again.', 'error');
    }
    redirect($back);
}

// ---------- page ----------

$flash = takeFlash();
$users = [];
$loadError = '';
try {
    $pdo = db();
    adminUsersTable($pdo);
    $users = $pdo->query('SELECT id, name, email, created_at, last_login FROM admin_users ORDER BY name')->fetchAll();
} catch (Throwable $e) {
    error_log('Users admin failed: ' . $e->getMessage());
    $loadError = 'The database is unavailable. Check the database settings in config.php.';
}
$resetId = (int) ($_GET['reset'] ?? 0);

pageStart('Users', 'users.php', true);
?>
      <div class="admin-head">
        <div>
          <p class="kicker">Admin</p>
          <h1>Users</h1>
        </div>
        <p class="muted" style="margin:0">Signed in as <?= h($_SESSION['admin_name'] ?? 'Main admin') ?></p>
      </div>

<?php if ($flash): ?>
      <p class="notice<?= $flash['kind'] === 'error' ? ' is-error' : '' ?>" role="status" style="margin-bottom:24px"><?= h($flash['message']) ?></p>
<?php endif; ?>

<?php if ($loadError): ?>
      <p class="notice is-error"><?= h($loadError) ?></p>
<?php else: ?>
      <details class="card song-card is-new" id="add"<?= !$users ? ' open' : '' ?>>
        <summary><h3>Add a user</h3></summary>
        <form method="post" action="users.php">
          <?= csrfField() ?>
          <input type="hidden" name="action" value="add">
          <div class="field-grid">
            <label class="field"><span>Name</span><input type="text" name="name" required maxlength="100" autocomplete="off"></label>
            <label class="field"><span>Email</span><input type="email" name="email" required maxlength="254" autocomplete="off"></label>
            <label class="field"><span>Password (at least <?= MIN_PASSWORD ?> characters)</span><input type="password" name="password" required minlength="<?= MIN_PASSWORD ?>" autocomplete="new-password"></label>
          </div>
          <p class="hint">They can use every admin page, including this one. Tell them their password yourself; nothing is emailed.</p>
          <div class="card-actions"><button class="btn btn-brass" type="submit">Add user</button></div>
        </form>
      </details>

      <h2>Who can sign in<small><?= count($users) + 1 ?></small></h2>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Added</th><th>Last signed in</th><th class="num"><span class="visually-hidden">Actions</span></th></tr></thead>
          <tbody>
            <tr>
              <td>Main admin<?= $me === 0 ? ' <span class="muted">(you)</span>' : '' ?></td>
              <td class="muted">Leave the email empty</td>
              <td class="muted" colspan="2">Password set in config.php on the server</td>
              <td class="num muted">Always on</td>
            </tr>
<?php foreach ($users as $user): $id = (int) $user['id']; ?>
            <tr id="user-<?= $id ?>">
              <td><?= h($user['name']) ?><?= $id === $me ? ' <span class="muted">(you)</span>' : '' ?></td>
              <td><?= h($user['email']) ?></td>
              <td class="when"><?= h(date('j M Y', strtotime($user['created_at']))) ?></td>
              <td class="when"><?= $user['last_login'] ? h(date('j M Y, H:i', strtotime($user['last_login']))) : 'Not yet' ?></td>
              <td class="num">
<?php if ($id === $resetId): ?>
                <form class="row-edit" method="post" action="users.php">
                  <?= csrfField() ?><input type="hidden" name="action" value="password"><input type="hidden" name="id" value="<?= $id ?>">
                  <label class="visually-hidden" for="new-password">New password for <?= h($user['name']) ?></label>
                  <input id="new-password" type="password" name="password" required minlength="<?= MIN_PASSWORD ?>" autocomplete="new-password" placeholder="New password" autofocus>
                  <button class="btn btn-brass btn-small" type="submit">Save</button>
                  <a class="btn btn-ghost btn-small" href="users.php#user-<?= $id ?>">Cancel</a>
                </form>
<?php else: ?>
                <div class="row-actions">
                  <a class="btn btn-ghost btn-small" href="users.php?reset=<?= $id ?>#user-<?= $id ?>">New password</a>
<?php if ($id !== $me): ?>
                  <form method="post" action="users.php" onsubmit="return confirm(<?= h(json_encode('Remove ' . $user['name'] . '? They will no longer be able to sign in.')) ?>)">
                    <?= csrfField() ?><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= $id ?>">
                    <button class="btn btn-danger btn-small" type="submit">Remove</button>
                  </form>
<?php endif; ?>
                </div>
<?php endif; ?>
              </td>
            </tr>
<?php endforeach; ?>
          </tbody>
        </table>
      </div>
<?php endif; ?>
<?php pageEnd(); ?>

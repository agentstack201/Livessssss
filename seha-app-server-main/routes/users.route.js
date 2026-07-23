const express = require('express');
const router = express.Router();
const usersController = require('../controller/users.controller');
const verifyToken = require('../middlewares/authMW');
const { checkPermission } = require('../middlewares/checkPermission');

// All routes require authentication
router.use(verifyToken);

// Get all users - requires can_view_users
router.get('/', checkPermission('can_view_users'), usersController.getAllUsers);

// Create new user - requires can_create_users
router.post('/', checkPermission('can_create_users'), usersController.createUser);

// Update user - requires can_edit_users
router.put('/:id', checkPermission('can_edit_users'), usersController.updateUser);

// Update user permissions only - requires can_edit_users
router.patch('/:id/permissions', checkPermission('can_edit_users'), usersController.updateUserPermissions);

// Delete user - requires can_delete_users
router.delete('/:id', checkPermission('can_delete_users'), usersController.deleteUser);

module.exports = router;

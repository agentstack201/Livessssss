'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('leaves', 'report_time', {
      type: Sequelize.STRING(191),
      allowNull: true,
      comment: 'وقت إصدار التقرير (يدوي أو تلقائي)'
    });

    await queryInterface.addColumn('leaves', 'report_date', {
      type: Sequelize.STRING(191),
      allowNull: true,
      comment: 'تاريخ إصدار التقرير (يدوي أو تلقائي)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('leaves', 'report_time');
    await queryInterface.removeColumn('leaves', 'report_date');
  }
};
